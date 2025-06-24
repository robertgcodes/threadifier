import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile } from '../../lib/database';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    const userProfile = await getUserProfile(userId);
    
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return relevant debug information
    return NextResponse.json({
      uid: userProfile.uid,
      email: userProfile.email,
      subscription: userProfile.subscription,
      credits: userProfile.credits,
      referralCode: userProfile.referralCode,
      referralCount: userProfile.referralCount,
      settings: userProfile.settings,
      updatedAt: userProfile.updatedAt?.toDate ? userProfile.updatedAt.toDate() : null,
    });
  } catch (error: any) {
    console.error('Error fetching user status:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}