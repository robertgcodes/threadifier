"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import toast from 'react-hot-toast';
import { Loader2, UserPlus, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function JoinTeamPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [invitationDetails, setInvitationDetails] = useState<any>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const token = searchParams.get('token');
  const teamId = searchParams.get('team');

  useEffect(() => {
    if (!token || !teamId) {
      setStatus('error');
      setLoading(false);
      return;
    }

    acceptInvitation();
  }, [token, teamId, user]);

  const acceptInvitation = async () => {
    try {
      // Check if user is logged in
      if (!user) {
        // Store the invitation URL to redirect after login
        localStorage.setItem('pendingTeamInvite', window.location.href);
        router.push('/login');
        return;
      }

      // Get invitation details
      const invitationRef = doc(firestore, 'users', teamId!, 'team', token!);
      const invitationDoc = await getDoc(invitationRef);

      if (!invitationDoc.exists()) {
        setStatus('error');
        setLoading(false);
        return;
      }

      const invitation = invitationDoc.data();
      setInvitationDetails(invitation);

      // Check if invitation is expired
      if (invitation.expiresAt && invitation.expiresAt.toDate() < new Date()) {
        setStatus('expired');
        setLoading(false);
        return;
      }

      // Check if invitation is for this user's email
      if (invitation.email !== user.email) {
        toast.error('This invitation is for a different email address');
        setStatus('error');
        setLoading(false);
        return;
      }

      // Check if already accepted
      if (invitation.status === 'accepted') {
        setStatus('success');
        setLoading(false);
        toast.success('You are already a member of this team');
        setTimeout(() => router.push('/'), 2000);
        return;
      }

      // Accept the invitation
      await updateDoc(invitationRef, {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedBy: user.uid
      });

      // Add user to team members (you might want to create a separate collection for this)
      const userTeamRef = doc(firestore, 'users', user.uid, 'teams', teamId!);
      await setDoc(userTeamRef, {
        teamId: teamId!,
        role: invitation.role,
        permissions: invitation.permissions || [],
        joinedAt: new Date(),
        invitedBy: invitation.invitedBy
      });

      setStatus('success');
      toast.success('Successfully joined the team!');
      
      // Redirect to main app after 2 seconds
      setTimeout(() => router.push('/'), 2000);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setStatus('error');
      toast.error('Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Processing invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Welcome to the Team!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You've successfully joined the team as a {invitationDetails?.role}.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Redirecting to Threadifier...
            </p>
          </div>
        )}

        {status === 'expired' && (
          <div className="text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Invitation Expired
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This invitation has expired. Please ask the team owner to send a new invitation.
            </p>
            <Link href="/" className="btn-primary inline-block">
              Go to Threadifier
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Invalid Invitation
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This invitation link is invalid or has already been used.
            </p>
            <Link href="/" className="btn-primary inline-block">
              Go to Threadifier
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}