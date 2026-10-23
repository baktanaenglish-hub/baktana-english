import {
  AVATARS,
  MAX_BONUS_HEARTS,
  MAX_FREEZES,
  SHOP_ITEMS,
  canBuy,
  type GemState,
  type ShopItemId,
} from '../lib/gems';

interface Props {
  gems: GemState;
  onBuy: (id: ShopItemId) => void;
  onAvatar: (id: string) => void;
}

/** The gem shop: bonus hearts, streak freezes and avatars. */
export function Shop({ gems, onBuy, onAvatar }: Props) {
  return (
    <div className="shop">
      <section className="gem-balance pop">
        <span className="gem-big" aria-hidden="true">
          💎
        </span>
        <div>
          <strong className="gem-count">{gems.gems}</strong>
          <span className="muted">יהלומים · אוספים אותם בשיעורים, בחזרות, במשימות ובתיבה היומית</span>
        </div>
      </section>

      <h2>חיזוקים</h2>
      <div className="shop-items">
        {SHOP_ITEMS.map((item) => {
          const stock =
            item.id === 'hearts' ? `${gems.bonusHearts}/${MAX_BONUS_HEARTS}` : `${gems.freezes}/${MAX_FREEZES}`;
          return (
            <div key={item.id} className="shop-item">
              <span className="shop-icon" aria-hidden="true">
                {item.icon}
              </span>
              <div className="shop-text">
                <strong>{item.title}</strong>
                <span className="muted">{item.description}</span>
                <span className="muted">במלאי: {stock}</span>
              </div>
              <button
                type="button"
                className="btn secondary small buy-btn"
                disabled={!canBuy(gems, item.id)}
                onClick={() => onBuy(item.id)}
                aria-label={`קנייה: ${item.title} ב־${item.price} יהלומים`}
              >
                💎 {item.price}
              </button>
            </div>
          );
        })}
      </div>

      <h2>דמויות לפרופיל</h2>
      <div className="avatar-grid">
        {AVATARS.map((avatar) => {
          const owned = gems.avatars.includes(avatar.id);
          const selected = gems.avatar === avatar.id;
          const affordable = gems.gems >= avatar.price;
          return (
            <button
              key={avatar.id}
              type="button"
              className={`avatar-item${owned ? ' owned' : ''}${selected ? ' selected' : ''}`}
              disabled={!owned && !affordable}
              aria-pressed={selected}
              onClick={() => onAvatar(avatar.id)}
              aria-label={`${avatar.name}${selected ? ' (נבחר)' : owned ? ' (שלכם)' : ` – ${avatar.price} יהלומים`}`}
            >
              <span className="avatar-emoji" aria-hidden="true">
                {avatar.emoji}
              </span>
              <span className="avatar-name">{avatar.name}</span>
              <span className="avatar-price">{selected ? '✓ נבחר' : owned ? 'בחירה' : `💎 ${avatar.price}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
