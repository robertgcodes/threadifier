import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

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
const auth = getAuth();

// Admin email addresses that have access to analytics
const ADMIN_EMAILS = [
  'robert@spotlightlawyer.com',
  // Add other admin emails here
];

interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  createdAt: any;
  subscription?: {
    plan: string;
    status: string;
    currentPeriodEnd?: any;
  };
  usage?: {
    threadsGenerated: number;
    monthlyThreads: number;
    totalApiCost?: number;
  };
  credits?: {
    premiumCredits: number;
    lifetime: number;
    used: number;
  };
}

interface ThreadData {
  title?: string;
  createdAt: any;
}

export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('X-Admin-Email');
    
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all users
    const usersSnapshot = await db.collection('users').get();
    const users: UserData[] = usersSnapshot.docs.map((doc: any) => ({ uid: doc.id, ...doc.data() }));

    // Calculate analytics
    const totalUsers = users.length;
    const activeSubscriptions = users.filter((user: UserData) => 
      user.subscription?.status === 'active' || user.subscription?.status === 'trialing'
    ).length;

    // Calculate revenue metrics
    let totalRevenue = 0;
    let monthlyRevenue = 0;
    let activeSubscriptionsRevenue = 0;

    users.forEach((user: UserData) => {
      if (user.subscription?.status === 'active' || user.subscription?.status === 'trialing') {
        if (user.subscription?.plan === 'professional') {
          const monthlyAmount = 29; // $29/month for professional plan
          activeSubscriptionsRevenue += monthlyAmount;
          monthlyRevenue += monthlyAmount;
        }
        // Add other plan calculations as needed
      }
    });

    // Calculate conversion rate (users with active subscriptions / total users)
    const conversionRate = totalUsers > 0 ? ((activeSubscriptions / totalUsers) * 100).toFixed(1) : 0;

    // Calculate ARPU (Average Revenue Per User)
    const arpu = totalUsers > 0 ? (monthlyRevenue / totalUsers).toFixed(2) : 0;

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentThreads = await db.collection('threads')
      .where('createdAt', '>=', thirtyDaysAgo)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const recentActivity = recentThreads.docs.map((doc: any) => {
      const data: ThreadData = doc.data();
      return {
        description: `New thread created: ${data.title || 'Untitled'}`,
        timestamp: data.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'
      };
    });

    // Get support tickets for open tickets count
    const openTicketsSnapshot = await db.collection('supportTickets')
      .where('status', '==', 'open')
      .get();
    
    const openTickets = openTicketsSnapshot.size;

    // Calculate churn rate (simplified - would need more sophisticated tracking)
    const churnRate = 0; // Placeholder - would need to track cancellations

    // Get usage statistics
    const totalThreadsGenerated = users.reduce((sum: number, user: UserData) => 
      sum + (user.usage?.threadsGenerated || 0), 0
    );

    const totalApiCost = users.reduce((sum: number, user: UserData) => 
      sum + (user.usage?.totalApiCost || 0), 0
    );

    // Get user growth over time
    const userGrowthData = await getUserGrowthData();

    const analytics = {
      totalUsers,
      activeSubscriptions,
      totalRevenue: totalRevenue.toFixed(2),
      monthlyRevenue: monthlyRevenue.toFixed(2),
      conversionRate: parseFloat(conversionRate.toString()),
      arpu: parseFloat(arpu.toString()),
      churnRate,
      openTickets,
      totalThreadsGenerated,
      totalApiCost: totalApiCost.toFixed(2),
      recentActivity,
      userGrowth: userGrowthData,
      // Additional metrics
      newUsersThisMonth: await getNewUsersCount(30),
      newUsersThisWeek: await getNewUsersCount(7),
      premiumUsers: users.filter((user: UserData) => (user.credits?.premiumCredits || 0) > 0).length,
      freeUsers: users.filter((user: UserData) => (user.credits?.premiumCredits || 0) === 0).length,
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

async function getUserGrowthData() {
  try {
    const now = new Date();
    const months: Array<{month: string, count: number}> = [];
    
    // Get data for last 6 months
    for (let i = 5; i >= 0; i--) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const usersSnapshot = await db.collection('users')
        .where('createdAt', '>=', startOfMonth)
        .where('createdAt', '<=', endOfMonth)
        .get();
      
      months.push({
        month: startOfMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        count: usersSnapshot.size
      });
    }
    
    return months;
  } catch (error) {
    console.error('Error getting user growth data:', error);
    return [];
  }
}

async function getNewUsersCount(days: number) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const usersSnapshot = await db.collection('users')
      .where('createdAt', '>=', startDate)
      .get();
    
    return usersSnapshot.size;
  } catch (error) {
    console.error('Error getting new users count:', error);
    return 0;
  }
} 