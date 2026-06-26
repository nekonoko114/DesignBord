import type { FormData } from '../../types/form';

interface StepProps {
  data: FormData;
  updateData: (fields: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const DESIGN_KEYWORDS = [
  '可愛い', 'カジュアル', 'フォーマル', 'カラフル', 'シック',
  'モダン', 'ネイチャー', '幻想的', 'パステル', 'モノトーン',
  '高級感', 'シンプル', '優しい', 'ポップ', 'クール',
  '知性的', '派手', 'メタリック', '重厚感', '和風', '清潔感', 'にぎやか'
];

const THEME_COLORS = [
  { label: '赤系', color: '#ef4444' },
  { label: '青系', color: '#3b82f6' },
  { label: '茶系', color: '#d97706' },
  { label: '緑系', color: '#22c55e' },
  { label: '黄/オレンジ', color: '#f59e0b' },
  { label: 'グレー系', color: '#64748b' },
  { label: '水色系', color: '#0ea5e9' },
  { label: '紫系', color: '#a855f7' },
];

export function Step4({ data, updateData, onNext, onPrev }: StepProps) {
  const toggleKeyword = (keyword: string) => {
    const current = new Set(data.designKeywords);
    if (current.has(keyword)) {
      current.delete(keyword);
    } else {
      current.add(keyword);
    }
    updateData({ designKeywords: Array.from(current) });
  };

  const toggleColor = (colorLabel: string) => {
    const current = new Set(data.themeColors);
    if (current.has(colorLabel)) {
      current.delete(colorLabel);
    } else {
      current.add(colorLabel);
    }
    updateData({ themeColors: Array.from(current) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <div className="step-fade-enter-active">
      <h2 style={{ fontSize: '1.4rem', marginBottom: '0.4rem', color: 'var(--accent-color)' }}>
        04. Visual & Aesthetics
      </h2>
      <p style={{ marginBottom: '1.2rem', opacity: 0.8, fontSize: '0.85rem' }}>デザインの方向性やテーマカラーを選択してください。</p>

      <form onSubmit={handleSubmit}>
        <div className="glass-panel" style={{ marginBottom: '1.2rem' }}>
          <label style={{ marginBottom: '0.6rem', display: 'block', fontSize: '0.9rem', fontWeight: 600 }}>デザインイメージ（複数選択可）</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {DESIGN_KEYWORDS.map(keyword => (
              <button
                key={keyword}
                type="button"
                onClick={() => toggleKeyword(keyword)}
                style={{
                  clipPath: 'none',
                  padding: '0.5rem 1rem',
                  minHeight: 'auto',
                  background: data.designKeywords.includes(keyword) ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                  color: data.designKeywords.includes(keyword) ? '#fff' : 'var(--text-color)',
                  border: `1px solid ${data.designKeywords.includes(keyword) ? 'var(--accent-color)' : 'var(--glass-border)'}`
                }}
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ marginBottom: '1.2rem' }}>
          <label style={{ marginBottom: '0.6rem', display: 'block', fontSize: '0.9rem', fontWeight: 600 }}>テーマカラー（複数選択可）</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
            {THEME_COLORS.map(({ label, color }) => (
              <div
                key={label}
                onClick={() => toggleColor(label)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  opacity: data.themeColors.includes(label) ? 1 : 0.5,
                  transform: data.themeColors.includes(label) ? 'scale(1.1)' : 'scale(1)',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', background: color,
                  border: data.themeColors.includes(label) ? '3px solid #fff' : 'none',
                  boxShadow: data.themeColors.includes(label) ? `0 0 15px ${color}` : 'none'
                }} />
                <span style={{ fontSize: '0.8rem' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="competitors">参考サイト・競合他社情報</label>
            <textarea
              id="competitors"
              rows={3}
              value={data.competitors}
              onChange={(e) => updateData({ competitors: e.target.value })}
              placeholder="参考にしたいサイトのURLや、ベンチマークとしている企業があればご記入ください。"
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.2rem' }}>
          <button type="button" onClick={onPrev} style={{ background: 'transparent', border: '2px solid var(--glass-border)', color: 'var(--text-color)' }}>
            <span style={{ marginRight: '0.5rem' }}>←</span> Back
          </button>
          <button type="submit">
            Next Step <span style={{ marginLeft: '0.5rem' }}>→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
