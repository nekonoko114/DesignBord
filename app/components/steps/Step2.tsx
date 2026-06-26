import type { FormData } from '../../types/form';
import { Building2, Target, ShoppingCart, Users, Sparkles } from 'lucide-react';

interface StepProps {
  data: FormData;
  updateData: (fields: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const siteTypes = [
  { value: 'corporate', label: 'コーポレートサイト', desc: '企業の信頼性を高める公式HP', icon: <Building2 size={26} /> },
  { value: 'lp', label: 'ランディングページ (LP)', desc: '商品・サービスの成約率を最大化', icon: <Target size={26} /> },
  { value: 'ec', label: 'ECサイト', desc: 'ネットショップ・物販・オンライン決済', icon: <ShoppingCart size={26} /> },
  { value: 'recruit', label: '採用サイト', desc: '求職者へ向けた魅力発信・応募獲得', icon: <Users size={26} /> },
  { value: 'other', label: 'その他', desc: 'メディア、ポートフォリオ、独自システム等', icon: <Sparkles size={26} /> },
];

export function Step2({ data, updateData, onNext, onPrev }: StepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const handleTextareaChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
    field: 'background' | 'purpose' | 'mustConvey'
  ) => {
    updateData({ [field]: e.target.value });
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <div className="step-fade-enter-active">
      <h2 style={{ fontSize: '1.4rem', marginBottom: '0.4rem', color: 'var(--accent-color)' }}>
        02. Project Purpose
      </h2>
      <p style={{ marginBottom: '1.2rem', opacity: 0.8, fontSize: '0.85rem' }}>Webサイトを制作する背景や目的を教えてください。</p>

      <form onSubmit={handleSubmit}>
        <div className="glass-panel" style={{ marginBottom: '1.2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, fontSize: '0.9rem' }}>サイト種別</label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1.2rem'
          }}>
            {siteTypes.map((item) => {
              const isSelected = data.siteType === item.value;
              return (
                <div
                  key={item.value}
                  onClick={() => updateData({ siteType: item.value })}
                  style={{
                    padding: '1rem 0.8rem',
                    borderRadius: '16px',
                    border: isSelected ? '1px solid var(--accent-color)' : '1px solid var(--glass-border)',
                    background: isSelected ? 'rgba(184, 156, 109, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    boxShadow: isSelected ? 'var(--shadow-in)' : 'var(--shadow-out)',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    textAlign: 'center',
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                  }}
                >
                  <div style={{ 
                    color: isSelected ? 'var(--accent-color)' : 'var(--text-color)', 
                    opacity: isSelected ? 1 : 0.6, 
                    transition: '0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.2rem'
                  }}>
                    {item.icon}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: isSelected ? 'var(--accent-color)' : 'var(--text-color)', transition: '0.3s' }}>{item.label}</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.5, lineHeight: '1.4' }}>{item.desc}</span>
                </div>
              );
            })}
          </div>
          {/* Validation element */}
          <input type="hidden" name="siteType" value={data.siteType} required />
        </div>

        <div className="asymmetry-container">
          <div className="glass-panel">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="background">制作の背景</label>
              <textarea
                id="background"
                rows={3}
                value={data.background}
                onChange={(e) => handleTextareaChange(e, 'background')}
                onFocus={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                placeholder="例）名刺代わりのサイトが欲しい、リニューアルしたい等"
                required
                style={{ resize: 'none', overflowY: 'hidden', minHeight: '80px' }}
              />
              <div style={{ textAlign: 'right', fontSize: '0.75rem', opacity: 0.4, marginTop: '0.4rem' }} className="font-gothic">
                {data.background.length} 文字
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="form-group">
              <label htmlFor="purpose">具体的なサイトの目的</label>
              <textarea
                id="purpose"
                rows={3}
                value={data.purpose}
                onChange={(e) => handleTextareaChange(e, 'purpose')}
                onFocus={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                placeholder="例）ビジネスを始めるにあたって対外的な信用を得るため"
                required
                style={{ resize: 'none', overflowY: 'hidden', minHeight: '80px' }}
              />
              <div style={{ textAlign: 'right', fontSize: '0.75rem', opacity: 0.4, marginTop: '0.4rem' }} className="font-gothic">
                {data.purpose.length} 文字
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="mustConvey">絶対に伝えたい情報</label>
              <textarea
                id="mustConvey"
                rows={3}
                value={data.mustConvey}
                onChange={(e) => handleTextareaChange(e, 'mustConvey')}
                onFocus={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                placeholder="例）サービス内容の詳細や、独自の強みについて"
                required
                style={{ resize: 'none', overflowY: 'hidden', minHeight: '80px' }}
              />
              <div style={{ textAlign: 'right', fontSize: '0.75rem', opacity: 0.4, marginTop: '0.4rem' }} className="font-gothic">
                {data.mustConvey.length} 文字
              </div>
            </div>
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', marginTop: '1.2rem' }}>
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
