import type { FormData } from '../../types/form';

interface StepProps {
  data: FormData;
  updateData: (fields: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function Step5({ data, updateData, onNext, onPrev }: StepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <div className="step-fade-enter-active">
      <h2 style={{ fontSize: '1.4rem', marginBottom: '0.4rem', color: 'var(--accent-color)' }}>
        05. Features & Assets
      </h2>
      <p style={{ marginBottom: '1.2rem', opacity: 0.8, fontSize: '0.85rem' }}>必要な機能や対応ブラウザ、ブランド素材について教えてください。</p>

      <form onSubmit={handleSubmit} className="asymmetry-container">
        <div className="glass-panel">
          <div className="form-group">
            <label htmlFor="pages">最低限作成するページ</label>
            <textarea
              id="pages"
              rows={2}
              value={data.pages}
              onChange={(e) => updateData({ pages: e.target.value })}
              placeholder="例）TOP、サービス一覧、会社概要、お問い合わせ"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="snsLink">SNS連携について</label>
            <textarea
              id="snsLink"
              rows={2}
              value={data.snsLink}
              onChange={(e) => updateData({ snsLink: e.target.value })}
              placeholder="例）Instagramのフィード表示、X(Twitter)のリンクのみ 等"
            />
          </div>
        </div>

        <div className="glass-panel">
          <div className="form-group">
            <label htmlFor="browsers">対応ブラウザ / レスポンシブ</label>
            <input
              id="browsers"
              type="text"
              value={data.browsers}
              onChange={(e) => updateData({ browsers: e.target.value })}
              placeholder="例）Safari, Chrome / PC・スマホ両対応"
            />
          </div>

          <div className="form-group">
            <label htmlFor="assets">ブランド素材の有無・共有方法</label>
            <textarea
              id="assets"
              rows={2}
              value={data.assets}
              onChange={(e) => updateData({ assets: e.target.value })}
              placeholder="例）ロゴデータ(AI)あり、Google Driveで共有予定"
            />
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', marginTop: '1.2rem' }}>
          <button type="button" onClick={onPrev} style={{ background: 'transparent', border: '2px solid var(--glass-border)', color: 'var(--text-color)' }}>
            <span style={{ marginRight: '0.5rem' }}>←</span> Back
          </button>
          <button type="submit">
            Confirm <span style={{ marginLeft: '0.5rem' }}>✓</span>
          </button>
        </div>
      </form>
    </div>
  );
}
