// 出退勤打刻のクライアントヘルパー
import { supabase } from '@/utils/supabase';

export async function clockIn(staffName) {
  if (!staffName) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch('/api/staff/attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'clock_in', staffName }),
    });
  } catch (e) { console.warn('[clockIn]', e?.message); }
}

export async function clockOut(staffName) {
  if (!staffName) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch('/api/staff/attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'clock_out', staffName }),
    });
  } catch (e) { console.warn('[clockOut]', e?.message); }
}

async function callAttendance(action, staffName) {
  if (!staffName) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch('/api/staff/attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, staffName }),
    });
  } catch (e) { console.warn(`[${action}]`, e?.message); }
}

export const breakStart = (staffName) => callAttendance('break_start', staffName);
export const breakEnd = (staffName) => callAttendance('break_end', staffName);
