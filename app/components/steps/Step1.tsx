import type { FormData } from '../../types/form';

interface StepProps {
  data: FormData;
  updateData: (fields: Partial<FormData>) => void;
  onNext: () => void;
}

export function Step1({ data, updateData, onNext }: StepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <div className="step-fade-enter-active">
      <h2 style={{ fontSize: '1.4rem', marginBottom: '0.4rem', color: 'var(--accent-color)' }}>
        01. Foundation
      </h2>
      <p style={{ marginBottom: '1.2rem', opacity: 0.8, fontSize: '0.85rem' }}>まずは基本情報とインフラ環境について教えてください。</p>

      <form onSubmit={handleSubmit} className="asymmetry-container">
        <div className="glass-panel">
          <div className="form-group">
            <label htmlFor="companyName">会社名 / お名前</label>
            <input
              id="companyName"
              type="text"
              required
              value={data.companyName}
              onChange={(e) => updateData({ companyName: e.target.value })}
              placeholder="株式会社○○ / 山田 太郎"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">お電話番号</label>
            <input
              id="phone"
              type="tel"
              value={data.phone}
              onChange={(e) => updateData({ phone: e.target.value })}
              placeholder="090-XXXX-XXXX"
            />
          </div>

          <div className="form-group">
            <label htmlFor="deadline">ご希望の納期</label>
            <input
              id="deadline"
              type="date"
              required
              value={data.deadline}
              onChange={(e) => updateData({ deadline: e.target.value })}
            />
          </div>
        </div>

        <div className="glass-panel">
          <div className="form-group">
            <label>サーバーはお持ちですか？</label>
            <div className="custom-radio-group">
              <label className="custom-radio">
                <input
                  type="radio"
                  name="hasServer"
                  checked={data.hasServer === true}
                  onChange={() => updateData({ hasServer: true })}
                />
                <span className="custom-radio-label">はい</span>
              </label>
              <label className="custom-radio">
                <input
                  type="radio"
                  name="hasServer"
                  checked={data.hasServer === false}
                  onChange={() => updateData({ hasServer: false })}
                />
                <span className="custom-radio-label">いいえ</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>ドメイン（URL）はお持ちですか？</label>
            <div className="custom-radio-group">
              <label className="custom-radio">
                <input
                  type="radio"
                  name="hasDomain"
                  checked={data.hasDomain === true}
                  onChange={() => updateData({ hasDomain: true })}
                />
                <span className="custom-radio-label">はい</span>
              </label>
              <label className="custom-radio">
                <input
                  type="radio"
                  name="hasDomain"
                  checked={data.hasDomain === false}
                  onChange={() => updateData({ hasDomain: false })}
                />
                <span className="custom-radio-label">いいえ</span>
              </label>
            </div>
          </div>

          {data.hasDomain && (
            <div className="form-group step-fade-enter-active">
              <label htmlFor="existingDomain">既存ドメインのURL</label>
              <input
                id="existingDomain"
                type="url"
                value={data.existingDomain}
                onChange={(e) => updateData({ existingDomain: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
          )}
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="submit">
            Next Step <span style={{ marginLeft: '0.5rem' }}>→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
