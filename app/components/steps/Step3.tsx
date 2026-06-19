import type { FormData } from '../../types/form';

interface StepProps {
  data: FormData;
  updateData: (fields: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function Step3({ data, updateData, onNext, onPrev }: StepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <div className="step-fade-enter-active">
      <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--accent-color)' }}>
        03. Brand & Tone
      </h2>
      <p style={{ marginBottom: '2rem', opacity: 0.8 }}>ブランドの性格や、ターゲットユーザーに対する印象を設定します。</p>

      <form onSubmit={handleSubmit} className="asymmetry-container">
        <div className="glass-panel" style={{ transform: 'translateY(1rem)' }}>
          <div className="form-group">
            <label htmlFor="targetAudience">ターゲット層</label>
            <textarea
              id="targetAudience"
              rows={2}
              value={data.targetAudience}
              onChange={(e) => updateData({ targetAudience: e.target.value })}
              placeholder="例）20代〜30代のビジネスパーソン、新規事業の取引先など"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="brandPersonality">ブランドパーソナリティ（性格）</label>
            <textarea
              id="brandPersonality"
              rows={2}
              value={data.brandPersonality}
              onChange={(e) => updateData({ brandPersonality: e.target.value })}
              placeholder="もしブランドを人に例えるなら？（例：誠実で温かい、先進的でクール）"
            />
          </div>
        </div>

        <div className="glass-panel">
          <div className="form-group">
            <label htmlFor="desiredEmotion">ユーザーに与えたい感情</label>
            <textarea
              id="desiredEmotion"
              rows={2}
              value={data.desiredEmotion}
              onChange={(e) => updateData({ desiredEmotion: e.target.value })}
              placeholder="サイトを見た時にどう感じてほしいですか？（例：ワクワク感、圧倒的な信頼感）"
            />
          </div>

          <div className="form-group">
            <label htmlFor="ngDesign">絶対に避けたいデザイン（NGデザイン）</label>
            <textarea
              id="ngDesign"
              rows={2}
              value={data.ngDesign}
              onChange={(e) => updateData({ ngDesign: e.target.value })}
              placeholder="こういうのは嫌だ、というものがあればご記入ください。"
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
