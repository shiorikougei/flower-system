'use client';
import { useState, useEffect } from 'react';
import { Building2, Bell, MessageCircle, Plus, Search, Link as LinkIcon, CheckCircle } from 'lucide-react';

export default function CorporatePortalPage() {
  // ※後ほどデータベース(Supabase)と繋ぎますが、UI確認用にダミーデータを入れています
  const [events, setEvents] = useState([
    { id: 1, type: '生誕祭', clientName: 'CLUB Louns', targetPerson: '一条 さくら 様', date: '2026-03-15', status: 'unbooked', expectedPrice: 50000, note: '毎年スタンド2基出ている' },
    { id: 2, type: '周年祝い', clientName: '株式会社 グローバルIT', targetPerson: '社長', date: '2026-03-20', status: 'booked', expectedPrice: 30000, note: '胡蝶蘭指定' },
    { id: 3, type: 'リニューアル', clientName: 'Bar NIGHT', targetPerson: '-', date: '2026-03-25', status: 'unbooked', expectedPrice: 20000, note: 'バルーン入り希望' },
    { id: 4, type: '生誕祭', clientName: 'Lounge V', targetPerson: '美咲 様', date: '2026-04-01', status: 'unbooked', expectedPrice: 40000, note: '' },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // ★ 追加：法人登録用の招待URLを発行してコピーする機能
  const handleGenerateInviteLink = () => {
    // ※後ほど実際に推測不可能なトークン（UUIDなど）を生成してDBに保存し、URLに付与します
    const dummyToken = Math.random().toString(36).substring(2, 15);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://florix.example.com';
    const inviteUrl = `${origin}/corporate/register?token=${dummyToken}`;
    
    navigator.clipboard.writeText(inviteUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  // 予約漏れアラート（ワンクリック営業）の機能
  const handleSendReminder = (event) => {
    const message = `【お花の予約のご案内】\nいつもお世話になっております。FLORIXです。\n\n来たる ${event.date.split('-')[1]}月${event.date.split('-')[2]}日 は、${event.clientName}の ${event.targetPerson !== '-' ? event.targetPerson + 'の' : ''}${event.type} とのことで、誠におめでとうございます！\n\nお祝いのお花（スタンド花や胡蝶蘭など）のご準備はお済みでしょうか？\n当店で承ることも可能ですので、もしよろしければご相談くださいませ！\n\n▼ 簡単オーダーはこちらから\nhttps://florix.example.com/order/default\n\nよろしくお願いいたします。`;
    
    navigator.clipboard.writeText(message);
    alert('営業用のメッセージテキストをコピーしました！\nLINEやメールに貼り付けて送信してください。');
  };

  const filteredEvents = events.filter(e => 
    e.clientName.includes(searchTerm) || e.targetPerson.includes(searchTerm)
  );

  return (
    <div className="pb-32 font-sans text-[#111111]">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-8 sticky top-0 z-10">
        <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E] flex items-center gap-2">
          <Building2 size={20} /> 法人・イベント名簿管理 <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-2">テスト運用中</span>
        </h1>
        
        <div className="flex items-center gap-3">
          {/* ★ 法人招待URL発行ボタン */}
          <button 
            onClick={handleGenerateInviteLink} 
            className="flex items-center gap-1.5 bg-white border border-[#2D4B3E]/30 text-[#2D4B3E] px-4 py-2 rounded-lg text-[12px] font-bold shadow-sm hover:bg-[#F7F7F7] transition-all relative overflow-hidden"
          >
            {isCopied ? <CheckCircle size={16} className="text-emerald-500" /> : <LinkIcon size={16} />}
            {isCopied ? 'URLをコピーしました！' : '法人招待URLを発行'}
          </button>

          <button className="flex items-center gap-1 bg-[#2D4B3E] text-white px-4 py-2 rounded-lg text-[12px] font-bold shadow-sm hover:bg-[#1f352b] transition-all">
            <Plus size={16} /> 名簿に追加
          </button>
        </div>
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
                <th className="p-4 text-[11px] font-bold text-[#999999]">日付</th>
                <th className="p-4 text-[11px] font-bold text-[#999999]">イベント内容</th>
                <th className="p-4 text-[11px] font-bold text-[#999999]">顧客・対象者</th>
                <th className="p-4 text-[11px] font-bold text-[#999999]">ステータス</th>
                <th className="p-4 text-[11px] font-bold text-[#999999] text-center">アクション</th>
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
    </div>
  );
}