
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, 
  Video, 
  BarChart3, 
  Clock, 
  Users, 
  CreditCard,
  Plus,
  Play,
  Calendar,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
  duration: number;
  created_at: string;
  participants: any[];
}

interface UserProfile {
  subscription_tier: string;
  credits_remaining: number;
  total_meetings: number;
  total_duration: number;
}

export const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    subscription_tier: 'free',
    credits_remaining: 30,
    total_meetings: 0,
    total_duration: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchRecentMeetings();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      if (data) {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchRecentMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching meetings:', error);
        return;
      }

      // Transform the data to match our Meeting interface
      const transformedMeetings = (data || []).map(meeting => ({
        id: meeting.id,
        title: meeting.title,
        platform: meeting.platform,
        status: meeting.status,
        duration: meeting.duration,
        created_at: meeting.created_at,
        participants: Array.isArray(meeting.participants) ? meeting.participants : []
      }));

      setMeetings(transformedMeetings);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (error) {
        toast.error('Failed to delete meeting');
        return;
      }

      toast.success('Meeting deleted successfully');
      fetchRecentMeetings();
    } catch (error) {
      toast.error('Failed to delete meeting');
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <Mic className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">OmniMeet</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant={userProfile.subscription_tier === 'free' ? 'secondary' : 'default'}>
                {userProfile.subscription_tier}
              </Badge>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {userProfile.credits_remaining} credits left
              </span>
              <Button onClick={signOut} variant="outline" size="sm">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back, {user?.user_metadata?.full_name || 'User'}!
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Manage your meetings and analyze conversations with AI
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Total Meetings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Video className="w-5 h-5 text-blue-600 mr-2" />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {userProfile.total_meetings}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Total Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatDuration(userProfile.total_duration)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Credits Left
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <CreditCard className="w-5 h-5 text-purple-600 mr-2" />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {userProfile.credits_remaining}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Users className="w-5 h-5 text-orange-600 mr-2" />
                <span className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                  {userProfile.subscription_tier}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link to="/meeting/new">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mr-4">
                    <Plus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Start Recording</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Begin a new meeting session</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/analytics">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mr-4">
                    <BarChart3 className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">View Analytics</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Analyze meeting insights</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/pricing">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mr-4">
                    <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Upgrade Plan</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Get more features</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Meetings */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Meetings</CardTitle>
            <CardDescription>Your latest meeting sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {meetings.length > 0 ? (
              <div className="space-y-4">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                        <Video className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{meeting.title}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                          <span className="capitalize">{meeting.platform}</span>
                          <span>•</span>
                          <span>{formatDate(meeting.created_at)}</span>
                          <span>•</span>
                          <span>{formatDuration(meeting.duration)}</span>
                          <Badge variant={meeting.status === 'completed' ? 'default' : 'secondary'}>
                            {meeting.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Link to={`/meeting/${meeting.id}`}>
                        <Button size="sm" variant="outline">
                          <Play className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </Link>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => deleteMeeting(meeting.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No meetings yet</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Start your first meeting to see it here
                </p>
                <Link to="/meeting/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Start Recording
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
