import type { FormData } from '../../types/form';

interface StepProps {
  data: FormData;
  updateData: (fields: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function Step2({ data, updateData, onNext, onPrev }: StepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <div className="step-fade-enter-active">
      <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--accent-color)' }}>
        02. Project Purpose
      </h2>
      <p style={{ marginBottom: '2rem', opacity: 0.8 }}>Webサイトを制作する背景や目的を教えてください。</p>

      <form onSubmit={handleSubmit} className="asymmetry-container">
        <div className="glass-panel">
          <div className="form-group">
            <label htmlFor="siteType">サイト種別</label>
            <select
              id="siteType"
              value={data.siteType}
              onChange={(e) => updateData({ siteType: e.target.value })}
              required
            >
              <option value="">選択してください</option>
              <option value="corporate">コーポレートサイト</option>
              <option value="lp">ランディングページ (LP)</option>
              <option value="ec">ECサイト</option>
              <option value="recruit">採用サイト</option>
              <option value="other">その他</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="background">制作の背景</label>
            <textarea
              id="background"
              rows={3}
              value={data.background}
              onChange={(e) => updateData({ background: e.target.value })}
              placeholder="例）名刺代わりのサイトが欲しい、リニューアルしたい等"
              required
            />
          </div>
        </div>

        <div className="glass-panel" style={{ transform: 'translateY(-1rem)' }}>
          <div className="form-group">
            <label htmlFor="purpose">具体的なサイトの目的</label>
            <textarea
              id="purpose"
              rows={3}
              value={data.purpose}
              onChange={(e) => updateData({ purpose: e.target.value })}
              placeholder="例）ビジネスを始めるにあたって対外的な信用を得るため"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="mustConvey">絶対に伝えたい情報</label>
            <textarea
              id="mustConvey"
              rows={3}
              value={data.mustConvey}
              onChange={(e) => updateData({ mustConvey: e.target.value })}
              placeholder="例）サービス内容の詳細や、独自の強みについて"
              required
            />
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
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
