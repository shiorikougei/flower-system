// 自動シフト生成
// POST /api/staff/shift-generate  Body: { yearMonth: 'YYYY-MM', defaultPatternId? }
//
// アルゴリズム（シンプル版）:
//   1. 各日付ループ
//   2. 固定休のスタッフ → 自動で「休み」割当
//   3. 希望休が出てる人 → 「休み」割当
//   4. 残ったスタッフから、過去30日の出勤回数が少ない順で必要人数だけ選抜 → 「出勤」割当
//   5. ロック済みのシフトはスキップ（保持）
//
// 出勤割当のパターン:
//   - defaultPatternId が指定されてればそのパターン
//   - なければ shiftConfig.patterns[0]（最初のパターン = 全日想定）
//   - パターン未登録なら開始10:00 終了18:00 のフォールバック

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

async function authAndTenant(request) {
  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) return { error: '未認証', status: 401 };
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return { error: '認証失敗', status: 401 };
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single();
  const tenantId = profile?.tenant_id;
  if (!tenantId) return { error: 'tenant_id取得失敗', status: 400 };
  return { supabaseAdmin, tenantId };
}

export async function POST(request) {
  try {
    const auth = await authAndTenant(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { yearMonth, defaultPatternId } = await request.json();
    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      return NextResponse.json({ error: 'yearMonth は YYYY-MM 形式' }, { status: 400 });
    }

    // 設定取得
    const { data: settingsRow } = await auth.supabaseAdmin
      .from('app_settings').select('settings_data').eq('id', auth.tenantId).single();
    const settings = settingsRow?.settings_data || {};
    const staffList = (settings.staffList || []).filter(s => s.role !== 'owner_only_account');  // 全員対象
    const shiftConfig = settings.shiftConfig || { patterns: [], requiredStaff: {} };
    if (staffList.length === 0) return NextResponse.json({ error: 'スタッフが登録されていません' }, { status: 400 });

    // デフォルトパターン
    const pattern = (defaultPatternId
      ? shiftConfig.patterns?.find(p => p.id === defaultPatternId)
      : shiftConfig.patterns?.[0]) || { id: 'default', name: '出勤', startTime: '10:00', endTime: '18:00' };

    const [yyyy, mm] = yearMonth.split('-').map(Number);
    const lastDay = new Date(yyyy, mm, 0).getDate();
    const monthDates = Array.from({ length: lastDay }, (_, i) => {
      const d = new Date(yyyy, mm - 1, i + 1);
      const dateStr = `${yyyy}-${String(mm).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
      return { day: i+1, dateStr, dayKey: DAY_KEYS[d.getDay()] };
    });

    // 既存シフト取得（ロック済みは触らない）
    const { data: existingShifts } = await auth.supabaseAdmin
      .from('shift_schedules').select('*').eq('tenant_id', auth.tenantId)
      .gte('date', monthDates[0].dateStr).lte('date', monthDates[lastDay-1].dateStr);
    const lockedKeys = new Set((existingShifts || []).filter(s => s.locked).map(s => `${s.staff_name}__${s.date}`));

    // 希望休取得
    const { data: holidayReqs } = await auth.supabaseAdmin
      .from('shift_holiday_requests').select('*').eq('tenant_id', auth.tenantId).eq('year_month', yearMonth);
    const holidayMap = {}; // [staffName][dateStr] = true
    (holidayReqs || []).forEach(h => {
      if (!holidayMap[h.staff_name]) holidayMap[h.staff_name] = {};
      holidayMap[h.staff_name][h.date] = true;
    });

    // 過去30日の出勤回数（公平割当用）
    const fromDate = new Date(); fromDate.setDate(fromDate.getDate() - 30);
    const { data: recentShifts } = await auth.supabaseAdmin
      .from('shift_schedules').select('staff_name, is_off')
      .eq('tenant_id', auth.tenantId)
      .gte('date', fromDate.toISOString().split('T')[0]);
    const workCount = {};
    (recentShifts || []).forEach(s => {
      if (!s.is_off) workCount[s.staff_name] = (workCount[s.staff_name] || 0) + 1;
    });

    // 一括 upsert 用配列
    const upserts = [];
    let assignedCount = 0;
    let skippedLocked = 0;
    let lacking = []; // 必要人数満たせなかった日

    for (const d of monthDates) {
      const required = shiftConfig.requiredStaff?.[d.dayKey] ?? 1;

      // ロック済みスタッフ
      const lockedForDay = (existingShifts || []).filter(s => s.date === d.dateStr && s.locked);
      const alreadyAssignedNames = new Set(lockedForDay.filter(s => !s.is_off).map(s => s.staff_name));
      const lockedOffNames = new Set(lockedForDay.filter(s => s.is_off).map(s => s.staff_name));

      // 候補スタッフ（固定休・希望休・ロック休でない）
      const candidates = staffList.filter(s => {
        if (lockedKeys.has(`${s.name}__${d.dateStr}`)) return false; // ロック済はスキップ
        if (Array.isArray(s.fixedDayOff) && s.fixedDayOff.includes(d.dayKey)) return false;
        if (holidayMap[s.name]?.[d.dateStr]) return false;
        return true;
      });

      // 必要人数 - すでにロックで出勤済みの数 = まだ必要な人数
      const needed = Math.max(0, required - alreadyAssignedNames.size);

      // 出勤回数の少ない順に並べて needed 人選抜
      const sorted = candidates.sort((a, b) => (workCount[a.name] || 0) - (workCount[b.name] || 0));
      const chosen = sorted.slice(0, needed);
      const chosenNames = new Set(chosen.map(c => c.name));

      // upsert: 全スタッフ分（chosen=出勤、それ以外=休み）
      for (const s of staffList) {
        if (lockedKeys.has(`${s.name}__${d.dateStr}`)) { skippedLocked++; continue; }
        const isOff = !chosenNames.has(s.name);
        upserts.push({
          tenant_id: auth.tenantId,
          staff_name: s.name,
          date: d.dateStr,
          pattern_id: isOff ? null : pattern.id,
          pattern_name: isOff ? null : pattern.name,
          start_time: isOff ? null : pattern.startTime,
          end_time: isOff ? null : pattern.endTime,
          is_off: isOff,
          is_auto_generated: true,
          locked: false,
          notes: null,
        });
        if (!isOff) workCount[s.name] = (workCount[s.name] || 0) + 1;
        if (!isOff) assignedCount++;
      }

      // 必要人数足りなかった日
      if ((alreadyAssignedNames.size + chosen.length) < required) {
        lacking.push({ date: d.dateStr, needed: required, actual: alreadyAssignedNames.size + chosen.length });
      }
    }

    // 一括 upsert
    if (upserts.length > 0) {
      // バッチで処理（500件ずつ）
      const chunkSize = 500;
      for (let i = 0; i < upserts.length; i += chunkSize) {
        await auth.supabaseAdmin
          .from('shift_schedules')
          .upsert(upserts.slice(i, i + chunkSize), { onConflict: 'tenant_id,staff_name,date' });
      }
    }

    return NextResponse.json({
      ok: true,
      assigned: assignedCount,
      skippedLocked,
      lackingDays: lacking,
      message: lacking.length > 0
        ? `生成完了。ただし ${lacking.length}日 で必要人数を満たせませんでした`
        : `生成完了！${assignedCount} 件のシフトを割り当てました`,
    });
  } catch (err) {
    console.error('[shift-generate]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
