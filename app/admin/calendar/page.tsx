"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar as CalendarIcon,
  Flag,
  X,
  Check,
  Lock,
  Shield,
  ArrowLeft
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";


interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  attendees: string[];
  isHoliday: boolean;
  isPublicHoliday: boolean;
  color: string;
  createdBy?: string;
  createdAt?: Date;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: Event[];
}

const AdminCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [, setIsAuthenticated] = useState(false);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(true);
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });
  const [showLogin, setShowLogin] = useState(true);

  // State for public holidays
  const [publicHolidays, setPublicHolidays] = useState<Array<{ date: string; name: string; color: string }>>([]);

  // Fetch events from Firestore
  const fetchEvents = async () => {
    try {
      if (!db) {
        console.error('Firestore not initialized');
        return;
      }
      
      const eventsRef = collection(db, 'events');
      const q = query(eventsRef, orderBy('date'));
      const querySnapshot = await getDocs(q);
      const eventsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || '',
          description: data.description || '',
          date: data.date || '',
          time: data.time || '',
          location: data.location || '',
          attendees: data.attendees || [],
          isHoliday: data.isHoliday || false,
          isPublicHoliday: data.isPublicHoliday || false,
          color: data.color || '#3b82f6',
          createdBy: data.createdBy || 'admin',
          createdAt: data.createdAt?.toDate() || new Date()
        } as Event;
      });
      setEvents(eventsData);
    } catch (error) {
      console.error('Error fetching events from Firebase:', error);
      setEvents([]);
    }
  };

  // Add new event
  const addEvent = async (eventData: Omit<Event, 'id'>) => {
    try {
      if (!db) {
        console.error('Firestore not initialized');
        return;
      }
      
      const docRef = await addDoc(collection(db, 'events'), {
        ...eventData,
        createdAt: new Date()
      });
      await fetchEvents();
      return docRef.id;
    } catch (error) {
      console.error('Error adding event to Firebase:', error);
    }
  };

  // Update event
  const updateEvent = async (eventId: string, eventData: Partial<Event>) => {
    try {
      if (!db) {
        console.error('Firestore not initialized');
        return;
      }
      
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, eventData);
      await fetchEvents();
    } catch (error) {
      console.error('Error updating event in Firebase:', error);
    }
  };

  // Delete event
  const deleteEvent = async (eventId: string) => {
    try {
      if (!db) {
        console.error('Firestore not initialized');
        return;
      }
      
      await deleteDoc(doc(db, 'events', eventId));
      await fetchEvents();
    } catch (error) {
      console.error('Error deleting event from Firebase:', error);
    }
  };

  // Load events when component mounts
  useEffect(() => {
    if (!showLogin) {
      fetchEvents();
    }
  }, [showLogin]);

  const colors = [
    { hex: '#3b82f6', name: 'Blue' },
    { hex: '#10b981', name: 'Green' },
    { hex: '#f59e0b', name: 'Amber' },
    { hex: '#ef4444', name: 'Red' },
    { hex: '#8b5cf6', name: 'Purple' },
    { hex: '#06b6d4', name: 'Cyan' },
    { hex: '#f97316', name: 'Orange' },
    { hex: '#ec4899', name: 'Pink' }
  ];

  // Simple admin authentication (in production, use proper auth)
  const handleLogin = () => {
    if (adminCredentials.username === 'admin' && adminCredentials.password === 'ecell2024') {
      setIsAuthenticated(true);
      setShowLogin(false);
    } else {
      alert('Invalid credentials!');
    }
  };

  // Fetch public holidays using Google Calendar API
  const fetchPublicHolidays = React.useCallback(async (year: number) => {
    try {
      setIsLoadingHolidays(true);
      
      // Google Calendar API endpoint for Indian holidays
      const calendarId = 'en.indian#holiday@group.v.calendar.google.com';
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY;
      
      if (!apiKey) {
        console.warn('Google Calendar API key not found, using fallback holidays');
        throw new Error('API key not configured');
      }
      
      const startDate = `${year}-01-01T00:00:00Z`;
      const endDate = `${year}-12-31T23:59:59Z`;
      
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
        `timeMin=${startDate}&timeMax=${endDate}&key=${apiKey}&singleEvents=true&orderBy=startTime`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Calendar API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      const formattedHolidays = data.items?.map((event: { start?: { date?: string; dateTime?: string }; summary?: string }) => {
        const startDate = event.start?.date || event.start?.dateTime;
        const date = new Date(startDate || '').toISOString().split('T')[0];
        return {
          date: date,
          name: event.summary || 'Holiday',
          color: '#ef4444'
        };
      }) || [];
      
      setPublicHolidays(formattedHolidays);
      console.log(`✅ Fetched ${formattedHolidays.length} holidays from Google Calendar API`);
      
    } catch (error) {
      console.error('Error fetching holidays from Google Calendar API:', error);
      
      // Fallback to comprehensive Indian holidays list
      const fallbackHolidays = [
        // National Holidays
        { date: `${year}-01-01`, name: 'New Year\'s Day', color: '#ef4444' },
        { date: `${year}-01-26`, name: 'Republic Day', color: '#ef4444' },
        { date: `${year}-05-01`, name: 'Labour Day', color: '#ef4444' },
        { date: `${year}-08-15`, name: 'Independence Day', color: '#ef4444' },
        { date: `${year}-10-02`, name: 'Gandhi Jayanti', color: '#ef4444' },
        { date: `${year}-11-14`, name: 'Children\'s Day', color: '#ef4444' },
        { date: `${year}-12-25`, name: 'Christmas', color: '#ef4444' },
        
        // Hindu Festivals
        { date: `${year}-01-14`, name: 'Makar Sankranti', color: '#ef4444' },
        { date: `${year}-01-15`, name: 'Pongal', color: '#ef4444' },
        { date: `${year}-02-14`, name: 'Valentine\'s Day', color: '#ef4444' },
        { date: `${year}-03-08`, name: 'International Women\'s Day', color: '#ef4444' },
        { date: `${year}-03-25`, name: 'Holi', color: '#ef4444' },
        { date: `${year}-03-29`, name: 'Good Friday', color: '#ef4444' },
        { date: `${year}-03-31`, name: 'Easter Sunday', color: '#ef4444' },
        { date: `${year}-04-10`, name: 'Eid al-Fitr', color: '#ef4444' },
        { date: `${year}-04-14`, name: 'Ambedkar Jayanti', color: '#ef4444' },
        { date: `${year}-04-15`, name: 'Baisakhi', color: '#ef4444' },
        { date: `${year}-05-01`, name: 'Labour Day', color: '#ef4444' },
        { date: `${year}-06-21`, name: 'International Yoga Day', color: '#ef4444' },
        { date: `${year}-07-20`, name: 'Eid al-Adha', color: '#ef4444' },
        { date: `${year}-08-15`, name: 'Independence Day', color: '#ef4444' },
        { date: `${year}-08-29`, name: 'Muharram', color: '#ef4444' },
        { date: `${year}-08-30`, name: 'Raksha Bandhan', color: '#ef4444' },
        { date: `${year}-09-05`, name: 'Teachers\' Day', color: '#ef4444' },
        { date: `${year}-10-02`, name: 'Gandhi Jayanti', color: '#ef4444' },
        { date: `${year}-10-31`, name: 'Halloween', color: '#ef4444' },
        { date: `${year}-11-12`, name: 'Diwali', color: '#ef4444' },
        { date: `${year}-11-14`, name: 'Children\'s Day', color: '#ef4444' },
        { date: `${year}-12-25`, name: 'Christmas', color: '#ef4444' },
        { date: `${year}-12-31`, name: 'New Year\'s Eve', color: '#ef4444' },
      ];
      setPublicHolidays(fallbackHolidays);
      console.log('📅 Using fallback holidays list');
    } finally {
      setIsLoadingHolidays(false);
    }
  }, []);

  // Fetch holidays when component mounts or year changes
  React.useEffect(() => {
    const year = currentDate.getFullYear();
    fetchPublicHolidays(year);
  }, [currentDate, fetchPublicHolidays]);

  const getDaysInMonth = (date: Date): CalendarDay[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days: CalendarDay[] = [];
    const today = new Date();
    
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.toDateString() === currentDate.toDateString();
      });
      
      days.push({
        date: currentDate,
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: currentDate.toDateString() === today.toDateString(),
        events: dayEvents
      });
    }
    
    return days;
  };

  const getWeekDays = (date: Date): CalendarDay[] => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    
    const days: CalendarDay[] = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.toDateString() === currentDate.toDateString();
      });
      
      days.push({
        date: currentDate,
        isCurrentMonth: true,
        isToday: currentDate.toDateString() === today.toDateString(),
        events: dayEvents
      });
    }
    
    return days;
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    attendees: '',
    isHoliday: false,
    isPublicHoliday: false,
    color: '#3b82f6'
  });

  const handleAddEvent = () => {
    setSelectedEvent(null);
    setFormData({
      title: '',
      description: '',
      date: formatDate(currentDate),
      time: '',
      location: '',
      attendees: '',
      isHoliday: false,
      isPublicHoliday: false,
      color: '#3b82f6'
    });
    setIsModalOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setFormData({
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      location: event.location,
      attendees: event.attendees.join(', '),
      isHoliday: event.isHoliday,
      isPublicHoliday: event.isPublicHoliday,
      color: event.color
    });
    setIsModalOpen(true);
  };

  const handleSaveEvent = async () => {
    const eventData = {
      title: formData.title,
      description: formData.description,
      date: formData.date,
      time: formData.time,
      location: formData.location,
      attendees: formData.attendees.split(',').map(a => a.trim()).filter(a => a),
      isHoliday: formData.isHoliday,
      isPublicHoliday: formData.isPublicHoliday,
      color: formData.color
    };

    if (selectedEvent) {
      await updateEvent(selectedEvent.id, eventData);
    } else {
      await addEvent(eventData);
    }

    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleDeleteEvent = async (eventId: string) => {
    await deleteEvent(eventId);
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const isPublicHoliday = (date: Date): { name: string; color: string } | null => {
    const dateStr = formatDate(date);
    const holiday = publicHolidays.find(h => h.date === dateStr);
    return holiday || null;
  };

  const days = viewMode === 'month' ? getDaysInMonth(currentDate) : getWeekDays(currentDate);

  // Login Form
  if (showLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-amber-900 dark:via-orange-900 dark:to-red-900 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border-2 border-amber-300 dark:border-amber-600">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-amber-800 dark:text-amber-200 font-serif">Admin Access</h2>
            <p className="text-amber-600 dark:text-amber-400 mt-2">Enter your credentials to manage events</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-amber-800 dark:text-amber-200 font-bold">Username</Label>
              <Input
                id="username"
                type="text"
                value={adminCredentials.username}
                onChange={(e) => setAdminCredentials({...adminCredentials, username: e.target.value})}
                className="border-2 border-amber-300 dark:border-amber-600 focus:border-amber-500"
                placeholder="Enter username"
              />
            </div>
            
            <div>
              <Label htmlFor="password" className="text-amber-800 dark:text-amber-200 font-bold">Password</Label>
              <Input
                id="password"
                type="password"
                value={adminCredentials.password}
                onChange={(e) => setAdminCredentials({...adminCredentials, password: e.target.value})}
                className="border-2 border-amber-300 dark:border-amber-600 focus:border-amber-500"
                placeholder="Enter password"
              />
            </div>
            
            <Button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-3"
            >
              <Lock className="h-4 w-4 mr-2" />
              Login
            </Button>
            
            <Button
              variant="outline"
              onClick={() => window.location.href = '/calendar'}
              className="w-full border-2 border-amber-300 text-amber-800 hover:bg-amber-50 font-bold"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Calendar
            </Button>
          </div>
          
          <div className="mt-6 text-center text-sm text-amber-600 dark:text-amber-400">
            <p>Demo Credentials:</p>
            <p>Username: admin</p>
            <p>Password: ecell2024</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-amber-900 dark:via-orange-900 dark:to-red-900">
      {/* Vintage Background Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      {/* Vintage Header */}
      <div className="relative bg-gradient-to-r from-amber-800 via-orange-800 to-red-800 shadow-2xl border-b-4 border-amber-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-24">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-600 rounded-full blur-lg opacity-75"></div>
                <div className="relative bg-gradient-to-br from-amber-400 to-orange-600 p-4 rounded-full border-4 border-amber-300 shadow-lg">
                  <CalendarIcon className="h-10 w-10 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white font-serif tracking-wider" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                  Admin Calendar
                </h1>
                <p className="text-amber-200 font-medium italic">
                  Manage Events & Holidays
                  {isLoadingHolidays && (
                    <span className="ml-3 inline-flex items-center text-amber-300">
                      <div className="w-2 h-2 bg-amber-300 rounded-full animate-pulse mr-1"></div>
                      Loading holidays...
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Vintage View Toggle */}
              <div className="flex bg-amber-700/50 backdrop-blur-sm rounded-xl p-1 border-2 border-amber-500">
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-6 py-3 rounded-lg text-sm font-bold transition-all duration-300 ${
                    viewMode === 'month'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg transform scale-105 border-2 border-amber-300'
                      : 'text-amber-200 hover:text-white hover:bg-amber-600/50'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-6 py-3 rounded-lg text-sm font-bold transition-all duration-300 ${
                    viewMode === 'week'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg transform scale-105 border-2 border-amber-300'
                      : 'text-amber-200 hover:text-white hover:bg-amber-600/50'
                  }`}
                >
                  Week
                </button>
              </div>

              {/* Vintage Navigation */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newDate = new Date(currentDate);
                    if (viewMode === 'month') {
                      newDate.setMonth(newDate.getMonth() - 1);
                    } else {
                      newDate.setDate(newDate.getDate() - 7);
                    }
                    setCurrentDate(newDate);
                  }}
                  className="border-2 border-amber-400 text-amber-800 hover:bg-amber-500 hover:text-white transition-all duration-300 font-bold"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                  className="border-2 border-green-400 text-green-800 hover:bg-green-500 hover:text-white transition-all duration-300 font-bold"
                >
                  Today
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newDate = new Date(currentDate);
                    if (viewMode === 'month') {
                      newDate.setMonth(newDate.getMonth() + 1);
                    } else {
                      newDate.setDate(newDate.getDate() + 7);
                    }
                    setCurrentDate(newDate);
                  }}
                  className="border-2 border-amber-400 text-amber-800 hover:bg-amber-500 hover:text-white transition-all duration-300 font-bold"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              {/* Admin Controls */}
              <Button 
                onClick={handleAddEvent}
                className="bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-2 border-green-400 font-bold"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>

              <Button 
                onClick={() => window.location.href = '/calendar'}
                className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-2 border-blue-400 font-bold"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                View Calendar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Vintage Calendar Grid */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Vintage Month/Year Header */}
        <div className="text-center mb-8">
          <h2 className="text-5xl font-bold text-amber-800 dark:text-amber-200 font-serif tracking-wider" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
            {currentDate.toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </h2>
        </div>

        {/* Vintage Day Headers */}
        <div className="grid grid-cols-7 gap-3 mb-6">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-800 dark:to-orange-800 backdrop-blur-sm p-4 text-center rounded-xl border-2 border-amber-300 dark:border-amber-600 shadow-lg">
              <span className="text-lg font-bold text-amber-800 dark:text-amber-200 font-serif">
                {day}
              </span>
            </div>
          ))}
        </div>

        {/* Vintage Calendar Grid */}
        <div className="grid grid-cols-7 gap-3">
          {days.map((day, index) => {
            const holiday = isPublicHoliday(day.date);
            return (
              <div
                key={index}
                className={`min-h-[160px] bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-800 dark:to-orange-800 backdrop-blur-sm p-4 rounded-xl border-2 border-amber-200 dark:border-amber-700 shadow-lg hover:shadow-xl transition-all duration-300 relative group ${
                  !day.isCurrentMonth ? 'opacity-40' : ''
                } ${day.isToday ? 'ring-4 ring-amber-500 ring-offset-2 ring-offset-amber-100 dark:ring-offset-amber-900' : ''}`}
              >
                {/* Vintage Date Number */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-lg font-bold font-serif ${
                    day.isToday 
                      ? 'text-amber-600 dark:text-amber-300' 
                      : 'text-amber-800 dark:text-amber-200'
                  }`}>
                    {day.date.getDate()}
                  </span>
                  
                  {/* Holiday Indicator */}
                  {holiday && (
                    <div className="flex items-center space-x-1">
                      <Flag className="h-4 w-4 text-red-500" />
                    </div>
                  )}
                </div>

                {/* Vintage Events */}
                <div className="space-y-2">
                  {day.events.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      className={`text-xs p-2 rounded-lg cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-md border-2 ${
                        event.isHoliday || event.isPublicHoliday
                          ? 'bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-600'
                          : 'bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-800/30 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-600'
                      }`}
                      style={{ 
                        background: event.isHoliday || event.isPublicHoliday 
                          ? `linear-gradient(135deg, ${event.color}20, ${event.color}30)` 
                          : `linear-gradient(135deg, ${event.color}20, ${event.color}30)`,
                        borderColor: event.color + '40'
                      }}
                      onClick={() => handleEditEvent(event)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate font-bold">{event.title}</span>
                        <Edit className="h-2 w-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                    </div>
                  ))}
                  
                  {day.events.length > 3 && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 text-center py-2 bg-amber-100/50 dark:bg-amber-800/50 rounded-lg border border-amber-300 dark:border-amber-600 font-bold">
                      +{day.events.length - 3} more
                    </div>
                  )}
                </div>

                {/* Vintage Holiday Name */}
                {holiday && (
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="text-xs text-red-600 dark:text-red-400 font-bold truncate bg-red-100 dark:bg-red-900/30 px-3 py-2 rounded-lg border-2 border-red-300 dark:border-red-600 shadow-md">
                      {holiday.name}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border-2 border-amber-300 dark:border-amber-600">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-amber-800 dark:text-amber-200 font-serif">
                  {selectedEvent ? 'Edit Event' : 'Add Event'}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="title" className="text-sm font-medium text-amber-800 dark:text-amber-200 font-bold">Event Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Enter event title"
                    className="mt-1 border-2 border-amber-300 dark:border-amber-600 focus:border-amber-500 dark:focus:border-amber-400"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-sm font-medium text-amber-800 dark:text-amber-200 font-bold">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Enter event description"
                    rows={3}
                    className="mt-1 border-2 border-amber-300 dark:border-amber-600 focus:border-amber-500 dark:focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date" className="text-sm font-medium text-amber-800 dark:text-amber-200 font-bold">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="mt-1 border-2 border-amber-300 dark:border-amber-600 focus:border-amber-500 dark:focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <Label htmlFor="time" className="text-sm font-medium text-amber-800 dark:text-amber-200 font-bold">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({...formData, time: e.target.value})}
                      className="mt-1 border-2 border-amber-300 dark:border-amber-600 focus:border-amber-500 dark:focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="location" className="text-sm font-medium text-amber-800 dark:text-amber-200 font-bold">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    placeholder="Enter location"
                    className="mt-1 border-2 border-amber-300 dark:border-amber-600 focus:border-amber-500 dark:focus:border-amber-400"
                  />
                </div>

                <div>
                  <Label htmlFor="attendees" className="text-sm font-medium text-amber-800 dark:text-amber-200 font-bold">Attendees (comma-separated)</Label>
                  <Input
                    id="attendees"
                    value={formData.attendees}
                    onChange={(e) => setFormData({...formData, attendees: e.target.value})}
                    placeholder="Enter attendees"
                    className="mt-1 border-2 border-amber-300 dark:border-amber-600 focus:border-amber-500 dark:focus:border-amber-400"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-amber-800 dark:text-amber-200 font-bold">Event Color</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {colors.map(color => (
                      <button
                        key={color.hex}
                        className={`w-8 h-8 rounded-full border-2 transition-all duration-300 hover:scale-110 ${
                          formData.color === color.hex 
                            ? 'border-amber-900 dark:border-amber-100 shadow-lg' 
                            : 'border-amber-300 dark:border-amber-600 hover:border-amber-400 dark:hover:border-amber-500'
                        }`}
                        style={{ backgroundColor: color.hex }}
                        onClick={() => setFormData({...formData, color: color.hex})}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.isHoliday}
                      onChange={(e) => setFormData({...formData, isHoliday: e.target.checked})}
                      className="rounded border-amber-300 dark:border-amber-600 text-amber-600 focus:ring-amber-500 dark:focus:ring-amber-400"
                    />
                    <span className="text-sm text-amber-800 dark:text-amber-200 font-bold">Holiday</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.isPublicHoliday}
                      onChange={(e) => setFormData({...formData, isPublicHoliday: e.target.checked})}
                      className="rounded border-amber-300 dark:border-amber-600 text-amber-600 focus:ring-amber-500 dark:focus:ring-amber-400"
                    />
                    <span className="text-sm text-amber-800 dark:text-amber-200 font-bold">Public Holiday</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-6 border-t border-amber-200 dark:border-amber-700">
                <div className="flex space-x-2">
                  <Button
                    onClick={handleSaveEvent}
                    className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 font-bold"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {selectedEvent ? 'Update Event' : 'Add Event'}
                  </Button>
                  {selectedEvent && (
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteEvent(selectedEvent.id)}
                      className="hover:bg-red-700 transform hover:scale-105 transition-all duration-300 font-bold"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="border-2 border-amber-300 dark:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-800/50 font-bold"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCalendar; 
