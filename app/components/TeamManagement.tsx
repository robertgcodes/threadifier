"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, Plus, Mail, UserPlus, UserCheck, UserX, Shield, Settings, Trash2, Edit, Eye, Send, Users, Crown, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuth } from 'firebase/auth';

interface TeamMember {
  id: string;
  email: string;
  displayName?: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  status: 'pending' | 'active' | 'inactive';
  invitedAt: any;
  joinedAt?: any;
  permissions: {
    canCreateThreads: boolean;
    canEditThreads: boolean;
    canPublishThreads: boolean;
    canManageTeam: boolean;
    canViewAnalytics: boolean;
  };
}

interface TeamInvitation {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  invitedBy: string;
  invitedAt: any;
  expiresAt: any;
  status: 'pending' | 'accepted' | 'expired';
}

interface TeamManagementProps {
  userProfile: any;
  onUpdateProfile: (updates: any) => void | Promise<void>;
}

export default function TeamManagement({ userProfile, onUpdateProfile }: TeamManagementProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  const roles = [
    {
      value: 'owner',
      label: 'Owner',
      description: 'Full access to everything',
      icon: Crown,
      color: 'text-purple-600'
    },
    {
      value: 'admin',
      label: 'Admin',
      description: 'Can manage team and all content',
      icon: Shield,
      color: 'text-red-600'
    },
    {
      value: 'editor',
      label: 'Editor',
      description: 'Can create and edit threads',
      icon: Edit,
      color: 'text-blue-600'
    },
    {
      value: 'viewer',
      label: 'Viewer',
      description: 'Can view and comment on threads',
      icon: Eye,
      color: 'text-green-600'
    }
  ];

  useEffect(() => {
    if (userProfile?.subscription?.plan === 'team') {
      loadTeamData();
    }
  }, [userProfile]);

  const loadTeamData = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        toast.error('Authentication required');
        return;
      }

      // Load team members and invitations
      const [membersResponse, invitationsResponse] = await Promise.all([
        fetch('/api/team/members', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }),
        fetch('/api/team/invitations', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      ]);

      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setTeamMembers(membersData.members);
      }

      if (invitationsResponse.ok) {
        const invitationsData = await invitationsResponse.json();
        setInvitations(invitationsData.invitations);
      }
    } catch (error) {
      console.error('Error loading team data:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const sendInvitation = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.emailSent) {
          toast.success(`Invitation sent to ${inviteEmail}`);
        } else {
          toast.success(`Invitation created for ${inviteEmail}. Note: Email service not configured - share the invite link manually.`);
        }
        setInviteEmail('');
        setInviteRole('editor');
        setShowInviteModal(false);
        loadTeamData();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send invitation');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    setLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      const response = await fetch(`/api/team/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: newRole,
        }),
      });

      if (response.ok) {
        toast.success('Team member role updated');
        loadTeamData();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update role');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      const response = await fetch(`/api/team/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('Team member removed');
        loadTeamData();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove member');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    setLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      const response = await fetch(`/api/team/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('Invitation cancelled');
        loadTeamData();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel invitation');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel invitation');
    } finally {
      setLoading(false);
    }
  };

  const getRoleInfo = (role: string) => {
    return roles.find(r => r.value === role) || roles[3];
  };

  // Check if user has team subscription
  const hasTeamSubscription = userProfile?.subscription?.plan === 'team';
  const isOwner = teamMembers.find(m => m.role === 'owner')?.email === userProfile?.email;

  if (!hasTeamSubscription) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Team Management
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Upgrade to the Team plan to invite team members and collaborate on content creation.
          </p>
          <button
            onClick={() => window.location.href = '/billing'}
            className="btn-primary"
          >
            Upgrade to Team Plan
          </button>
        </div>
      </div>
    );
  }

  if (loading && teamMembers.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Team Management</h2>
          <p className="text-gray-600 dark:text-gray-400">Invite team members and manage permissions</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {/* Team Members */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members ({String(teamMembers.length)})
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {teamMembers.map((member) => {
            const roleInfo = getRoleInfo(member.role);
            const RoleIcon = roleInfo.icon;
            
            return (
              <div key={member.id} className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {member.displayName?.charAt(0) || member.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {member.displayName || 'No name'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <RoleIcon className={`w-4 h-4 ${roleInfo.color}`} />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {roleInfo.label}
                    </span>
                  </div>
                  
                  {member.role !== 'owner' && (
                    <div className="flex items-center gap-2">
                      <select
                        value={member.role}
                        onChange={(e) => updateMemberRole(member.id, e.target.value)}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
                      >
                        {roles.filter(r => r.value !== 'owner').map(role => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      
                      <button
                        onClick={() => removeMember(member.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {teamMembers.length === 0 && (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              No team members yet. Invite someone to get started!
            </div>
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Pending Invitations ({String(invitations.length)})
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {invitations.map((invitation) => {
              const roleInfo = getRoleInfo(invitation.role);
              const RoleIcon = roleInfo.icon;
              
              return (
                <div key={invitation.id} className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{invitation.email}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Invited {invitation.invitedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <RoleIcon className={`w-4 h-4 ${roleInfo.color}`} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {roleInfo.label}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => cancelInvitation(invitation.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      title="Cancel invitation"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Invite Team Member</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="colleague@company.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  {roles.filter(r => r.value !== 'owner').map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label} - {role.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={sendInvitation}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 inline mr-2" />
                    Send Invitation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 