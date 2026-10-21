// [2026-10 画面リニューアル] お客様側の書体（本文 BIZ UDPゴシック・見出しは明朝）。app/globals.css の .ui-customer
export default function CustomerFontLayout({ children }) {
  return <div className="ui-renewal ui-customer">{children}</div>;
}
