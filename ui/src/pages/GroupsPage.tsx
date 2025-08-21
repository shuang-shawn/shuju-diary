import { useEffect, useState } from 'react';
import { api } from '@/lib/serverComm';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface Group {
  groups: {
    id: string;
    name: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  };
  group_members: {
    groupId: string;
    userId: string;
    joinedAt: string;
    role: string;
  };
}

export function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  console.log('Current groups state:', groups);

  useEffect(() => {
    if (user?.uid) {
      fetchGroups();
    }
  }, [user?.uid]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      console.log('Attempting to fetch groups...');
      const data = await api.getGroups();
      console.log('Groups fetched successfully:', data);
      setGroups(data);
      setError('');
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      setError('Failed to load groups. Please try again later.');
      setShowErrorDialog(true); // Open the dialog for loading errors
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setError('Group name cannot be empty.');
      setShowErrorDialog(true); // Open the dialog
      return;
    }
    try {
      console.log('Attempting to create group with name:', newGroupName);
      const newGroup = await api.createGroup(newGroupName);
      console.log('New group created successfully:', newGroup);
      setGroups((prev) => {
        const newGroupWithNestedStructure = {
          groups: newGroup,
          group_members: {
            groupId: newGroup.id,
            userId: user!.uid, // user is guaranteed to exist here due to useEffect condition
            joinedAt: new Date().toISOString(),
            role: 'admin',
          },
        };
        const updatedGroups = [...prev, newGroupWithNestedStructure];
        console.log('Groups state after creation:', updatedGroups);
        return updatedGroups;
      });
      setNewGroupName('');
      setError('');
    } catch (err) {
      console.error('Failed to create group:', err);
      setError('Failed to create group. Please try again.');
      setShowErrorDialog(true); // Open the dialog for other errors too
    }
  };

  if (loading) {
    return <div className="container mx-auto p-6 text-center">Loading groups...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">My Groups</h1>

      <div className="mb-8 p-4 border rounded-lg shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Create New Group</h2>
        <div className="flex space-x-2">
          <Input
            type="text"
            placeholder="Enter group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleCreateGroup}>Create Group</Button>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mb-4">Your Existing Groups</h2>
      {
        groups.length === 0 ? (
          <p className="text-muted-foreground">You are not a member of any groups yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((item) => (
              <Card key={item.groups.id}>
                <CardHeader>
                  <CardTitle>{item.groups.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">Created: {new Date(item.groups.createdAt).toLocaleDateString()}</p>
                  <Link to={`/groups/${item.groups.id}`}>
                    <Button variant="outline">View Group</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      }
      
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>{error}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowErrorDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
