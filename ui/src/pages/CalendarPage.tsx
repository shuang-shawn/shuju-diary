import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Import calendar styles
import { api } from '@/lib/serverComm';
import { useAuth } from '@/lib/auth-context';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

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

interface DiaryNote {
  id: string;
  groupId: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Helper to format date to YYYY-MM-DD for consistent comparison
const formatDateToYYYYMMDD = (date: Date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function CalendarPage() {
  const { user } = useAuth();
  const { theme } = useTheme(); // Get the current theme
  const [date, setDate] = useState(new Date());
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [notes, setNotes] = useState<DiaryNote[]>([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [datesWithNotes, setDatesWithNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.uid) {
      fetchGroups();
    }
  }, [user?.uid]);

  useEffect(() => {
    if (selectedGroupId && user?.uid) {
      fetchAllNotesForGroup(); // Fetch all notes for the group to determine dates with notes
      fetchNotesForSelectedDate(); // Fetch notes specifically for the selected date
    }
  }, [selectedGroupId, date, user?.uid]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await api.getGroups();
      setGroups(data);
      if (data.length > 0 && !selectedGroupId) {
        setSelectedGroupId(data[0].groups.id); // Select the first group by default
      }
      setError('');
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      setError('Failed to load groups. Please try again later.');
      setShowErrorDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllNotesForGroup = async () => {
    if (!selectedGroupId) return;

    try {
      const allNotes = await api.getDiaryNotesByGroupId(selectedGroupId);
      const dates = new Set<string>();
      allNotes.forEach(note => {
        dates.add(formatDateToYYYYMMDD(new Date(note.createdAt)));
      });
      setDatesWithNotes(dates);
    } catch (err) {
      console.error('Failed to fetch all notes for group:', err);
      // Don't show error dialog here, as it's a background process
    }
  };

  const fetchNotesForSelectedDate = async () => {
    if (!selectedGroupId || !user?.uid) return;

    try {
      setLoading(true);
      const allNotesInGroup = await api.getDiaryNotesByGroupId(selectedGroupId);
      const notesOnSelectedDate = allNotesInGroup.filter(note => {
        return formatDateToYYYYMMDD(new Date(note.createdAt)) === formatDateToYYYYMMDD(date);
      });
      setNotes(notesOnSelectedDate);
      setError('');
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      setError('Failed to load notes for this date. Please try again later.');
      setShowErrorDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (newDate: any) => {
    setDate(newDate);
  };

  const handleCreateNote = async () => {
    if (!selectedGroupId) {
      setError('Please select a group to add a note.');
      setShowErrorDialog(true);
      return;
    }
    if (!noteTitle.trim() || !noteContent.trim()) {
      setError('Note title and content cannot be empty.');
      setShowErrorDialog(true);
      return;
    }

    try {
      const newNote = await api.createDiaryNote(selectedGroupId, noteTitle, noteContent, date.toISOString()); // Pass selected date
      // After creating a note, re-fetch all notes for the group to update datesWithNotes
      await fetchAllNotesForGroup();
      await fetchNotesForSelectedDate(); // Re-fetch notes for the current selected date
      setNoteTitle('');
      setNoteContent('');
      setError('');
    } catch (err) {
      console.error('Failed to create note:', err);
      setError('Failed to create note. Please try again.');
      setShowErrorDialog(true);
    }
  };

  const tileContent = ({ date: tileDate, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      if (datesWithNotes.has(formatDateToYYYYMMDD(tileDate))) {
        return (
          <div className="flex justify-center items-center mt-1">
            <div className="w-2 h-2 rounded-full bg-blue-500 border border-blue-700 shadow-sm" title="Notes available"></div>
          </div>
        );
      }
    }
    return null;
  };

  if (loading) {
    return <div className="container mx-auto p-6 text-center">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Calendar</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex flex-col items-center">
          <Calendar
            onChange={handleDateChange}
            value={date}
            tileContent={tileContent}
            className={cn({'calendar-dark-mode': theme === 'dark'})}
          />
          <div className="mt-4 w-full max-w-sm">
            <h2 className="text-xl font-semibold mb-2">Select Group:</h2>
            <Select onValueChange={setSelectedGroupId} value={selectedGroupId || ''}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((groupItem) => (
                  <SelectItem key={groupItem.groups.id} value={groupItem.groups.id}>
                    {groupItem.groups.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col">
          <h2 className="text-2xl font-semibold mb-4">Notes for {date.toLocaleDateString()}:</h2>
          <div className="space-y-4">
            {notes.length === 0 ? (
              <p className="text-muted-foreground">No notes for this date yet.</p>
            ) : (
              notes.map((note) => (
                <Card key={note.id}>
                  <CardHeader>
                    <CardTitle>{note.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">{new Date(note.createdAt).toLocaleString()}</p>
                    <p>{note.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="mt-8 p-4 border rounded-lg shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">Add New Note</h2>
            <div className="space-y-4">
              <div>
                <Input
                  placeholder="Note Title"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                />
              </div>
              <div>
                <Textarea
                  placeholder="Note Content"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                />
              </div>
              <Button onClick={handleCreateNote}>Add Note</Button>
            </div>
          </div>
        </div>
      </div>
      
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
