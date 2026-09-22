import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { redirect } from 'next/navigation';
import MeetingRoom from '@/components/MeetingRoom';

export default async function RoomPage({ params }) {
  const { roomId } = await params;

  // Server-side auth guard — unauthenticated users are redirected to home
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/');
  }

  return <MeetingRoom roomId={roomId} />;
}
