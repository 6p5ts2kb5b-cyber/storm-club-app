// 予備日にあたる日の案内（青い帯）：延期のとき／実施のとき
import { md, type ReserveInfo, reserveHeading, umpireStatusText } from "@/lib/reserve";

export default function ReserveBanner({ reserves, heldPlan }: { reserves: ReserveInfo[]; heldPlan: string }) {
  if (reserves.length === 0) return null;
  return (
    <div className="rsv-banner">
      {reserves.map((r) => (
        <div key={`${r.fromDate}-${r.division}`} className="rsv-banner__item">
          <p className="rsv-banner__head">☂ {reserveHeading(r)}</p>
          <p className="rsv-banner__row">
            <span>延期のとき</span>
            {r.name}
            {r.venue ? `（${r.venue}）` : ""}
            {r.firstDate ? `　※${md(r.firstDate)}も延期の場合` : ""}
          </p>
          {(r.umpires.length > 0 || r.needed > 0) && (
            <p className="rsv-banner__row">
              <span>延期の審判</span>
              {r.umpireGather ? `審判集合 ${r.umpireGather}　` : ""}
              {umpireStatusText(r.umpires, r.needed)}
            </p>
          )}
          <p className="rsv-banner__row">
            <span>実施のとき</span>
            <b>{heldPlan}</b>
          </p>
        </div>
      ))}
    </div>
  );
}
