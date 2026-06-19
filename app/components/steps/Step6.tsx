import { useState } from 'react';
import type { FormData } from '../../types/form';
import { useNavigate } from 'react-router';

interface StepProps {
  data: FormData;
  onPrev: () => void;
  onReset: () => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
}

export function Step6({ data, onPrev, onReset, onSubmit, isSubmitting }: StepProps) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    try {
      await onSubmit();
      alert('ヒアリング内容を送信しました！ダッシュボードへ戻ります。');
      navigate('/client/dashboard');
    } catch (e) {
      setError('データの送信に失敗しました。もう一度お試しいただくか、管理者へお問い合わせください。');
    }
  };

  return (
    <div className="step-fade-enter-active">
      <h2 className="font-mincho" style={{ fontSize: '2.2rem', marginBottom: '1rem', color: 'var(--accent-color)', fontWeight: 600 }}>
        ヒアリング完了
      </h2>
      <p className="font-gothic" style={{ marginBottom: '1.5rem', opacity: 0.8, lineHeight: 1.8 }}>
        ヒアリングへのご協力、誠にありがとうございました。<br/>
        以下の内容でご要望を承りました。
      </p>
      
      <div style={{ padding: '1.5rem', background: 'rgba(184, 156, 109, 0.05)', borderRadius: '12px', borderLeft: '4px solid var(--accent-color)', marginBottom: '3rem' }}>
        <p className="font-gothic" style={{ margin: 0, fontWeight: 500, color: 'var(--text-color)' }}>
          ✅ 次のステップ：オンラインでのお打ち合わせ（キックオフ）<br/>
          <span style={{ fontSize: '0.9rem', opacity: 0.8, fontWeight: 400 }}>担当者より、ご入力いただいた内容を元に具体的なご提案をさせていただきます。</span>
        </p>
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h3 className="font-mincho" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--neu-border)', paddingBottom: '0.5rem', fontSize: '1.3rem' }}>
          ご入力内容の確認
        </h3>
        
        <dl className="font-gothic" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem 2rem', margin: 0, lineHeight: 1.8 }}>
          <dt style={{ opacity: 0.7, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>会社名 / お名前</dt>
          <dd style={{ margin: 0, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>{data.companyName || '未入力'}</dd>

          <dt style={{ opacity: 0.7, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>お電話番号</dt>
          <dd style={{ margin: 0, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>{data.phone || '未入力'}</dd>

          <dt style={{ opacity: 0.7, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>ご希望の納期</dt>
          <dd style={{ margin: 0, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>{data.deadline || '未入力'}</dd>

          <dt style={{ opacity: 0.7, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>プロジェクトの目的</dt>
          <dd style={{ margin: 0, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>{data.purpose || '未入力'}</dd>

          <dt style={{ opacity: 0.7, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>ターゲット層</dt>
          <dd style={{ margin: 0, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>{data.targetAudience || '未入力'}</dd>

          <dt style={{ opacity: 0.7, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>デザインの方向性</dt>
          <dd style={{ margin: 0, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            {data.designKeywords.length > 0 ? data.designKeywords.join(' / ') : '未選択'}
          </dd>

          <dt style={{ opacity: 0.7, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>テーマカラー</dt>
          <dd style={{ margin: 0, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            {data.themeColors.length > 0 ? data.themeColors.join(' / ') : '未選択'}
          </dd>
        </dl>
      </div>

      {error && (
        <div style={{ 
          padding: '1rem', 
          borderRadius: '12px', 
          backgroundColor: 'rgba(220, 53, 69, 0.1)', 
          border: '1px solid rgba(220, 53, 69, 0.2)', 
          color: '#dc3545', 
          fontSize: '0.9rem', 
          marginBottom: '2rem', 
          textAlign: 'center' 
        }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', marginTop: '3rem' }}>
        <button 
          type="button" 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          style={{ 
            width: '100%', 
            maxWidth: '400px', 
            background: 'var(--accent-color)', 
            color: 'var(--bg-color)', 
            border: 'none', 
            boxShadow: '0 8px 15px rgba(184, 156, 109, 0.3)',
            opacity: isSubmitting ? 0.7 : 1,
            cursor: isSubmitting ? 'not-allowed' : 'pointer'
          }}
        >
          {isSubmitting ? '送信中...' : 'この内容で送信する'}
        </button>
        
        <div style={{ display: 'flex', gap: '2rem' }}>
          <button 
            type="button" 
            onClick={onPrev} 
            disabled={isSubmitting}
            style={{ 
              background: 'transparent', 
              border: '1px solid var(--neu-border)', 
              color: 'var(--text-color)', 
              padding: '0.8rem 2rem', 
              boxShadow: 'none',
              opacity: isSubmitting ? 0.5 : 1,
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            修正する
          </button>
          <button 
            type="button" 
            onClick={onReset} 
            disabled={isSubmitting}
            style={{ 
              background: 'transparent', 
              border: '1px solid var(--neu-border)', 
              color: 'var(--text-color)', 
              padding: '0.8rem 2rem', 
              boxShadow: 'none', 
              opacity: isSubmitting ? 0.4 : 0.8,
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            初めから入力し直す
          </button>
        </div>
      </div>
    </div>
  );
}
