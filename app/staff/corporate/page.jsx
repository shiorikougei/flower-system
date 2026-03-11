'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Building2, Bell, MessageCircle, Calendar, Plus, ExternalLink, Search } from 'lucide-react';

export default function CorporatePortalPage() {
  // ※後ほどデータベース(Supabase)と繋ぎますが、UI確認用にダミーデータを入れています
  const [events, setEvents] = useState([
    { id: 1, type: '生誕祭', clientName: 'CLUB Louns', targetPerson: '一条 さくら 様', date: '2026-03-15', status: 'unbooked', expectedPrice: 50000, note: '毎年スタンド2基出ている' },
    { id: 2, type: '周年祝い', clientName: '株式会社 グローバルIT', targetPerson: '社長', date: '2026-03-20', status: 'booked', expectedPrice: 30000, note: '胡蝶蘭指定' },
    { id: 3, type: 'リニューアル', clientName: 'Bar NIGHT', targetPerson: '-', date: '2026-03-25', status: 'unbooked', expectedPrice: 20000, note: 'バルーン入り希望' },
    { id: 4, type: '生誕祭', clientName: 'Lounge V', targetPerson: '美咲 様', date: '2026-04-01', status: 'unbooked', expectedPrice: 40000, note: '' },
  ]);

  const [searchTerm, setSearchTerm] = useState('');

  // 予約漏れアラート（ワンクリック営業）の機能
  const handleSendReminder = (event) => {
    // ※本来はLINE APIやメール機能と連動させます。今回はコピー用のテキストを生成します。
    const message = `【お花の予約のご案内】\nいつもお世話になっております。FLORIXです。\n\n来たる ${event.date.split('-')[1]}月${event.date.split('-')[2]}日 は、${event.clientName}の ${event.targetPerson !== '-' ? event.targetPerson + 'の' : ''}${event.type} とのことで、誠におめでとうございます！🎉\n\nお祝いのお花（スタンド花や胡蝶蘭など）のご準備はお済みでしょうか？\n当店で承ることも可能ですので、もしよろしければご相談くださいませ！\n\n▼ 簡単オーダーはこちらから\nhttps://florix.example.com/order/default\n\nよろしくお願いいたします。`;
    
    // クリップボードにコピー
    navigator.clipboard.writeText(message);
    alert('営業用のメッセージテキストをコピーしました！\nLINEやメールに貼り付けて送信してください。');
  };

  const filteredEvents = events.filter(e => 
    e.clientName.includes(searchTerm) || e.targetPerson.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row text-[#111111] font-sans">
      
      {/* サイドバー（共通） */}
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-20 overflow-y-auto pb-10 hidden md:block">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA]">
          <span className="font-serif italic text-[24px] tracking-tight text-[#2D4B3E]">FLORIX</span>
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1">B2B CRM</span>
        </div>
        <nav className="p-4 space-y-1">
          <Link href="/staff" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">🏠 ダッシュボード</Link>
          <Link href="/staff/corporate" className="block px-6 py-4 rounded-xl bg-[#2D4B3E]/5 text-[#2D4B3E] shadow-sm border border-[#2D4B3E]/10 text-[13px] font-bold tracking-wider transition-all">法人・イベント管理</Link>
        </nav>
      </aside>

      <main className="flex-1 md:ml-64 flex flex-col min-w-0 pb-32">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-8 sticky top-0 z-10">
          <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E] flex items-center gap-2">
            <Building2 size={20} /> 法人・イベント名簿管理 <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-2">テスト運用中</span>
          </h1>
          <button className="flex items-center gap-1 bg-[#2D4B3E] text-white px-4 py-2 rounded-lg text-[12px] font-bold shadow-sm hover:bg-[#1f352b] transition-all">
            <Plus size={16} /> 名簿に追加
          </button>
        </header>

        <div className="max-w-[1000px] mx-auto w-full p-4 md:p-8 space-y-6">
          
          <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl flex items-start gap-4 shadow-sm">
            <div className="bg-emerald-100 p-3 rounded-full text-emerald-600 mt-1"><Bell size={24} /></div>
            <div>
              <h2 className="text-[15px] font-bold text-emerald-800">予約漏れアラート（直近1ヶ月のイベント）</h2>
              <p className="text-[12px] text-emerald-600 mt-1">過去に注文があった、またはリストに登録されているイベントのうち、<strong className="text-red-500 underline">まだ予約が入っていない</strong>ものが自動表示されます。「営業する」ボタンから即座に案内を送り、売上の取りこぼしを防ぎましょう。</p>
            </div>
          </div>

          <div className="flex items-center bg-white border border-[#EAEAEA] rounded-xl px-4 py-2 shadow-sm">
            <Search size={18} className="text-[#999999]" />
            <input 
              type="text" 
              placeholder="店舗名やキャスト名で検索..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 h-10 px-3 outline-none text-[13px]"
            />
          </div>

          <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-[13px] min-w-[800px]">
              <thead className="bg-[#FBFAF9] border-b border-[#EAEAEA]">
                <tr>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">日付</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">イベント内容</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">顧客・対象者</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">ステータス</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest text-center">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F7F7F7]">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-[#FBFAF9] transition-all">
                    <td className="p-4 font-mono font-bold text-[#555555]">{ev.date}</td>
                    <td className="p-4">
                      <span className="font-bold text-[#2D4B3E]">{ev.type}</span>
                      {ev.note && <p className="text-[10px] text-[#999999] mt-0.5">{ev.note}</p>}
                    </td>
                    <td className="p-4">
                      <p className="font-bold">{ev.clientName}</p>
                      <p className="text-[11px] text-[#555555]">{ev.targetPerson}</p>
                    </td>
                    <td className="p-4">
                      {ev.status === 'booked' ? (
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[11px] font-bold rounded-full">予約済・対応中</span>
                      ) : (
                        <span className="px-3 py-1 bg-red-50 text-red-500 border border-red-200 text-[11px] font-bold rounded-full animate-pulse">未予約！要確認</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {ev.status === 'unbooked' ? (
                        <button 
                          onClick={() => handleSendReminder(ev)}
                          className="flex items-center justify-center gap-1 mx-auto px-4 py-2 bg-[#2D4B3E] text-white rounded-lg text-[11px] font-bold hover:bg-[#1f352b] transition-all shadow-sm active:scale-95"
                        >
                          <MessageCircle size={14} /> 営業(案内)する
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400 font-bold">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </main>

    </div>
  );
}