import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/serverComm';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Users, FileText, Plus, Edit, Trash2, AlertCircle } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

interface GroupMember {
  group_members: {
    groupId: string;
    userId: string;
    joinedAt: string;
    role: string;
  };
  users: {
    id: string;
    email: string;
    display_name: string | null;
    photo_url: string | null;
    created_at: string;
    updated_at: string;
  };
}

interface DiaryNote {
  id: string;
  groupId: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export function GroupDetailPage() {
  const { user } = useAuth();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [notes, setNotes] = useState<DiaryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNote, setEditingNote] = useState<DiaryNote | null>(null);
  const [editedNoteTitle, setEditedNoteTitle] = useState('');
  const [editedNoteContent, setEditedNoteContent] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (groupId && user?.uid) {
      console.log('Logged in User ID:', user.uid);
      fetchGroupData();
    }
  }, [groupId, user?.uid]);

  const fetchGroupData = async () => {
    try {
      setLoading(true);
      const [groupData, membersData, notesData] = await Promise.all([
        api.getGroupById(groupId!),
        api.getGroupMembers(groupId!),
        api.getDiaryNotesByGroupId(groupId!),
      ]);

      console.log('Fetched groupData for details page:', groupData);
      console.log('Group Creator ID:', groupData.createdBy);

      setGroup(groupData); // Corrected: remove [0] as backend sends single object
      setMembers(membersData); // membersData should already be correctly mapped from backend
      setNotes(notesData);
      setError('');
    } catch (err) {
      console.error('Failed to fetch group data:', err);
      setError('Failed to load group data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!memberEmail.trim()) {
      setError('Member email cannot be empty.');
      return;
    }
    try {
      // This now sends the email to the backend, which will resolve it to a user ID
      await api.addGroupMember(groupId!, memberEmail);
      setIsAddingMember(false);
      setMemberEmail('');
      fetchGroupData(); // Refresh data
    } catch (err) {
      console.error('Failed to add member:', err);
      setError('Failed to add member. Make sure the user email is valid.');
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    try {
      await api.removeGroupMember(groupId!, memberUserId);
      // If the current user removed themselves, redirect to the groups list
      if (user?.uid === memberUserId) {
        navigate('/groups');
      } else {
        fetchGroupData(); // Otherwise, refresh data for other members
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError('Failed to remove member.');
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim()) {
      setError('Note title and content cannot be empty.');
      return;
    }
    try {
      await api.createDiaryNote(groupId!, newNoteTitle, newNoteContent);
      setIsCreatingNote(false);
      setNewNoteTitle('');
      setNewNoteContent('');
      fetchGroupData(); // Refresh data
    } catch (err) {
      console.error('Failed to create note:', err);
      setError('Failed to create note. Please try again.');
    }
  };

  const handleEditNote = (note: DiaryNote) => {
    setEditingNote(note);
    setEditedNoteTitle(note.title);
    setEditedNoteContent(note.content);
  };

  const handleSaveNote = async () => {
    if (!editingNote) return;
    if (!editedNoteTitle.trim() || !editedNoteContent.trim()) {
      setError('Note title and content cannot be empty.');
      return;
    }
    try {
      await api.updateDiaryNote(groupId!, editingNote.id, editedNoteTitle, editedNoteContent);
      setEditingNote(null);
      fetchGroupData();
    } catch (err) {
      console.error('Failed to update note:', err);
      setError('Failed to update note. Please try again.');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await api.deleteDiaryNote(groupId!, noteId);
      fetchGroupData();
    } catch (err) {
      console.error('Failed to delete note:', err);
      setError('Failed to delete note.');
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId) return;
    try {
      await api.deleteGroup(groupId);
      navigate('/groups'); // Redirect to groups list after deletion
    } catch (err) {
      console.error('Failed to delete group:', err);
      setError('Failed to delete group. Please try again.');
    }
  };

  if (loading) {
    return <div className="container mx-auto p-6 text-center">Loading group details...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-6 text-center text-red-500">{error}</div>;
  }

  if (!group) {
    return <div className="container mx-auto p-6 text-center">Group not found.</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{group.name}</h1>
        <div className="flex space-x-2">
          {user?.uid === group.createdBy && (
            <Button variant="destructive" onClick={() => setIsConfirmingDelete(true)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete Group
            </Button>
          )}
          <Button onClick={() => setIsAddingMember(true)}>
            <Users className="w-4 h-4 mr-2" /> Add Member
          </Button>
          <Button onClick={() => setIsCreatingNote(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Note
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Group Members</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground">No members in this group yet.</p>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => (
                <li key={member.users.id} className="flex items-center justify-between">
                  <span>{member.users.display_name || member.users.email} ({member.group_members.role})</span>
                  {user?.uid === member.users.id && (
                    <Button variant="destructive" size="sm" onClick={() => handleRemoveMember(member.users.id)}>
                      Remove (Self)
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diary Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-muted-foreground">No diary notes in this group yet.</p>
          ) : (
            <div className="grid gap-4">
              {notes.map((note) => (
                <Card key={note.id}>
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      <span>{note.title}</span>
                      <div className="flex space-x-2">
                        {user?.uid === note.userId && (
                          <Button variant="outline" size="sm" onClick={() => handleEditNote(note)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {user?.uid === note.userId && (
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteNote(note.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm mb-2">By: {members.find(m => m.users.id === note.userId)?.users.display_name || members.find(m => m.users.id === note.userId)?.users.email || note.userId}</p>
                    <p className="text-sm mb-4">{note.content}</p>
                    <p className="text-xs text-muted-foreground">Last updated: {new Date(note.updatedAt).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={isAddingMember} onOpenChange={setIsAddingMember}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to {group.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="memberEmail">Member User ID (e.g., Firebase UID)</Label>
            <Input
              id="memberEmail"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="Enter user ID or email"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingMember(false)}>Cancel</Button>
            <Button onClick={handleAddMember}>Add Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Note Dialog */}
      <Dialog open={isCreatingNote} onOpenChange={setIsCreatingNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Note for {group.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="newNoteTitle">Title</Label>
            <Input
              id="newNoteTitle"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              placeholder="Note title"
            />
            <Label htmlFor="newNoteContent">Content</Label>
            <Textarea
              id="newNoteContent"
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Note content"
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingNote(false)}>Cancel</Button>
            <Button onClick={handleCreateNote}>Create Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog open={!!editingNote} onOpenChange={() => setEditingNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note: {editingNote?.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="editedNoteTitle">Title</Label>
            <Input
              id="editedNoteTitle"
              value={editedNoteTitle}
              onChange={(e) => setEditedNoteTitle(e.target.value)}
              placeholder="Note title"
            />
            <Label htmlFor="editedNoteContent">Content</Label>
            <Textarea
              id="editedNoteContent"
              value={editedNoteContent}
              onChange={(e) => setEditedNoteContent(e.target.value)}
              placeholder="Note content"
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNote(null)}>Cancel</Button>
            <Button onClick={handleSaveNote}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Group Dialog */}
      <Dialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Group Deletion</DialogTitle>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <p>Are you sure you want to delete the group "{group.name}"? This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmingDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteGroup}>Delete Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
