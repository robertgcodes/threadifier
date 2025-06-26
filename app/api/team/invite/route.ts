import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { Resend } from 'resend';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

// Initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const { email, role, permissions } = await request.json();

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }

    // Get inviter details
    const inviterDoc = await db.collection('users').doc(userId).get();
    const inviterData = inviterDoc.data();
    const inviterName = inviterData?.displayName || inviterData?.email || 'A team member';

    // Check if user is already a team member
    const existingMember = await db.collection('users').doc(userId).collection('team').where('email', '==', email).get();
    
    if (!existingMember.empty) {
      return NextResponse.json({ error: 'User is already a team member' }, { status: 400 });
    }

    // Create invitation
    const invitationData = {
      email,
      role,
      permissions: permissions || [],
      status: 'pending',
      invitedBy: userId,
      invitedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    const invitationRef = await db.collection('users').doc(userId).collection('team').add(invitationData);

    // Send email invitation if Resend is configured
    if (resend) {
      try {
        const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://threadifier.com'}/join-team?token=${invitationRef.id}&team=${userId}`;
        
        await resend.emails.send({
          from: 'Threadifier Team <team@threadifier.com>',
          to: email,
          subject: `You've been invited to join a team on Threadifier`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e293b;">Team Invitation</h2>
              <p style="color: #475569; font-size: 16px;">Hi there,</p>
              <p style="color: #475569; font-size: 16px;">
                ${inviterName} has invited you to join their team on Threadifier as a <strong>${role}</strong>.
              </p>
              <p style="color: #475569; font-size: 16px;">
                With Threadifier, you can collaborate on creating engaging social media threads from long-form content.
              </p>
              <div style="margin: 30px 0;">
                <a href="${inviteUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Accept Invitation
                </a>
              </div>
              <p style="color: #64748b; font-size: 14px;">
                This invitation will expire in 7 days. If you have any questions, please contact the person who invited you.
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
              <p style="color: #94a3b8; font-size: 12px;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
          `,
        });
        
        console.log(`Email invitation sent to ${email} for team ${userId}`);
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
        // Don't fail the whole request if email fails - invitation is still created
      }
    } else {
      console.log('Email service not configured. Invitation created but email not sent.');
    }

    return NextResponse.json({ 
      success: true, 
      invitationId: invitationRef.id,
      invitation: { id: invitationRef.id, ...invitationData },
      emailSent: !!resend
    });
  } catch (error) {
    console.error('Error creating team invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}