import { useState, useEffect } from 'react';
import { useSubmit } from 'react-router';
import type { FormData } from '../types/form';
import { initialFormData } from '../types/form';
import { Step1 } from './steps/Step1';
import { Step2 } from './steps/Step2';
import { Step3 } from './steps/Step3';
import { Step4 } from './steps/Step4';
import { Step5 } from './steps/Step5';
import { Step6 } from './steps/Step6';
import { useAuth } from '../contexts/AuthContext';

export function FormWizard({ 
  initialData, 
  initialTermsAccepted = false 
}: { 
  initialData?: FormData | null; 
  initialTermsAccepted?: boolean;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(initialTermsAccepted);
  const [showTermsModal, setShowTermsModal] = useState(!initialTermsAccepted);
  const [draftSavedMessage, setDraftSavedMessage] = useState<string | null>(null);
  
  const { currentUser, refreshProjectData } = useAuth();
  const submit = useSubmit();

  const TOTAL_STEPS = 6;

  const stepsInfo = [
    { title: '基本情報', desc: '会社名・納期など' },
    { title: '目的・背景', desc: 'プロジェクトの目標' },
    { title: 'ブランド設定', desc: 'ターゲットやトーン' },
    { title: 'デザイン', desc: 'カラーや参考サイト' },
    { title: '必要な機能', desc: 'ページ構成や素材' },
    { title: '最終確認', desc: 'ご入力内容の確認' },
  ];

  useEffect(() => {
    const loadData = () => {
      let dataLoaded = false;
      
      if (initialData) {
        setFormData(initialData);
        dataLoaded = true;
      }

      if (!dataLoaded) {
        const saved = localStorage.getItem('designBoardFormData');
        if (saved) {
          try {
            setFormData(JSON.parse(saved));
          } catch (e) {
            console.error('Failed to parse saved form data');
          }
        }
      }

      const savedStep = localStorage.getItem('designBoardStep');
      if (savedStep) {
        setCurrentStep(parseInt(savedStep, 10));
      }
      setIsLoaded(true);
    };

    loadData();
  }, [initialData]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('designBoardFormData', JSON.stringify(formData));
      localStorage.setItem('designBoardStep', currentStep.toString());
    }
  }, [formData, currentStep, isLoaded]);

  const updateData = (fields: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setFormData(initialFormData);
    localStorage.removeItem('designBoardFormData');
    localStorage.removeItem('designBoardStep');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDraftSave = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    setDraftSavedMessage(null);
    try {
      submit(
        { 
          data: JSON.stringify(formData), 
          actionType: "draft",
          termsAccepted: termsAccepted.toString()
        },
        { method: "post" }
      );
      setDraftSavedMessage("入力内容を一時保存（下書き）しました。");
      setTimeout(() => setDraftSavedMessage(null), 4000);
    } catch (e) {
      console.error('一時保存エラー:', e);
      setDraftSavedMessage("一時保存に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      submit(
        { 
          data: JSON.stringify(formData), 
          actionType: "submit",
          termsAccepted: "true"
        },
        { method: "post" }
      );

      // Clear local storage
      localStorage.removeItem('designBoardFormData');
      localStorage.removeItem('designBoardStep');

      await refreshProjectData();
    } catch (e) {
      console.error('送信エラー:', e);
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTermsAgreement = () => {
    setTermsAccepted(true);
    setShowTermsModal(false);
  };

  if (!isLoaded) return null;

  return (
    <div style={{ position: 'relative' }}>
      {/* 初回規約同意オーバーレイ */}
      {showTermsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 10, 10, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="neumorphic-panel" style={{
            maxWidth: '600px',
            width: '100%',
            padding: '2.5rem',
            textAlign: 'center',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h2 className="font-mincho" style={{ fontSize: '1.6rem', marginBottom: '1.5rem', color: 'var(--accent-color)' }}>
              デザインヒアリング開始にあたっての同意
            </h2>
            <p className="font-gothic" style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1.5rem', textAlign: 'left', lineHeight: '1.6' }}>
              ヒアリングシートのご入力にあたり、以下の重要事項およびキャンセルポリシーをご確認の上、同意をお願いいたします。
            </p>
            
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--neu-border)',
              borderRadius: '8px',
              padding: '1rem',
              textAlign: 'left',
              fontSize: '0.85rem',
              lineHeight: '1.6',
              overflowY: 'auto',
              flex: 1,
              marginBottom: '1.5rem',
              maxHeight: '200px'
            }}>
              <p style={{ margin: '0 0 0.8rem 0', fontWeight: 'bold' }}>1. キャンセルポリシーについて</p>
              <p style={{ margin: '0 0 1rem 0', opacity: 0.8 }}>
                制作開始後のクライアント都合によるキャンセルの場合、制作進行度合い（ワイヤーフレーム作成、デザインカンプ作成等）に応じた実費をご請求させていただく場合がございます。
              </p>
              
              <p style={{ margin: '0 0 0.8rem 0', fontWeight: 'bold' }}>2. ヒアリングデータの取り扱い</p>
              <p style={{ margin: '0 0 1rem 0', opacity: 0.8 }}>
                ご回答いただいたヒアリング内容は、本プロジェクトのWebサイトデザイン制作の目的にのみ使用し、機密を保持いたします。
              </p>

              <p style={{ margin: '0 0 0.8rem 0', fontWeight: 'bold' }}>3. 知的財産権およびコピーガード</p>
              <p style={{ margin: '0 0 0 0', opacity: 0.8 }}>
                提示するデザインカンプは弊社の著作物であり、無断でのスクリーンショット保存や第三者への共有、転載を禁止します。また、システムで施されているコピーガード機能を故意に解除する行為を行わないでください。
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.8rem',
              marginBottom: '2rem'
            }}>
              <input 
                type="checkbox" 
                id="terms-checkbox" 
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="terms-checkbox" className="font-gothic" style={{ fontSize: '0.9rem', cursor: 'pointer', opacity: 0.9 }}>
                上記の重要事項およびキャンセルポリシーに同意します。
              </label>
            </div>

            <button
              type="button"
              onClick={handleTermsAgreement}
              disabled={!termsAccepted}
              style={{
                width: '100%',
                background: termsAccepted ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.05)',
                color: termsAccepted ? 'var(--bg-color)' : 'var(--text-muted)',
                border: 'none',
                boxShadow: termsAccepted ? '0 8px 15px rgba(184, 156, 109, 0.3)' : 'none',
                cursor: termsAccepted ? 'pointer' : 'not-allowed',
                padding: '1rem'
              }}
            >
              同意してヒアリングを始める
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem', display: 'grid', gridTemplateColumns: '260px 1fr', gap: '3rem', alignItems: 'start' }}>
        
        {/* 縦型の進捗ステップ (Vertical Stepper) */}
        <div style={{ position: 'sticky', top: '2rem' }}>
          <h3 className="font-mincho" style={{ marginBottom: '2rem', fontSize: '1.2rem', paddingLeft: '0.5rem' }}>進捗ステップ</h3>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {stepsInfo.map((step, idx) => {
              const stepNum = idx + 1;
              const isCompleted = stepNum < currentStep;
              const isActive = stepNum === currentStep;
              
              return (
                <div key={stepNum} style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch' }}>
                  {/* タイムラインの丸と線 */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ 
                      width: '36px', height: '36px', borderRadius: '50%', 
                      background: isActive ? 'var(--accent-color)' : (isCompleted ? 'var(--bg-color)' : 'transparent'),
                      boxShadow: isActive ? '0 0 15px var(--accent-glow)' : (isCompleted ? 'var(--shadow-in)' : 'none'),
                      border: isActive ? 'none' : (isCompleted ? '1px solid rgba(184, 156, 109, 0.4)' : '1px solid var(--neu-border)'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isActive ? 'var(--bg-color)' : (isCompleted ? 'var(--accent-color)' : 'var(--text-muted)'),
                      fontWeight: 600, fontSize: '0.9rem', zIndex: 2,
                      fontFamily: 'var(--font-gothic)'
                    }}>
                      {isCompleted ? '✓' : stepNum}
                    </div>
                    {/* 線 */}
                    {stepNum !== TOTAL_STEPS && (
                      <div style={{ 
                        width: '2px', flex: 1, minHeight: '40px',
                        background: isCompleted ? 'var(--accent-color)' : 'var(--neu-border)',
                        opacity: isCompleted ? 0.3 : 0.5,
                        margin: '0.4rem 0'
                      }} />
                    )}
                  </div>
                  {/* ステップのテキスト */}
                  <div style={{ paddingBottom: '2.5rem', paddingTop: '0.4rem', cursor: isCompleted ? 'pointer' : 'default' }} onClick={() => isCompleted && setCurrentStep(stepNum)}>
                    <div className="font-gothic" style={{ 
                      fontWeight: isActive ? 600 : (isCompleted ? 500 : 400),
                      color: isActive ? 'var(--accent-color)' : (isCompleted ? 'var(--text-color)' : 'var(--text-muted)'),
                      fontSize: '1rem',
                      letterSpacing: '0.05em'
                    }}>
                      {step.title}
                    </div>
                    <div className="font-gothic" style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '0.3rem' }}>{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* メインの入力パネル */}
        <div className="neumorphic-panel" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {currentStep === 1 && <Step1 data={formData} updateData={updateData} onNext={nextStep} />}
            {currentStep === 2 && <Step2 data={formData} updateData={updateData} onNext={nextStep} onPrev={prevStep} />}
            {currentStep === 3 && <Step3 data={formData} updateData={updateData} onNext={nextStep} onPrev={prevStep} />}
            {currentStep === 4 && <Step4 data={formData} updateData={updateData} onNext={nextStep} onPrev={prevStep} />}
            {currentStep === 5 && <Step5 data={formData} updateData={updateData} onNext={nextStep} onPrev={prevStep} />}
            {currentStep === 6 && (
              <Step6 
                data={formData} 
                onPrev={prevStep} 
                onReset={resetForm} 
                onSubmit={handleSubmit} 
                isSubmitting={isSubmitting} 
              />
            )}
          </div>

          {/* 一時保存完了等のインラインメッセージ */}
          {draftSavedMessage && (
            <div style={{
              margin: '1.5rem 0 0 0',
              padding: '0.8rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(184, 156, 109, 0.1)',
              border: '1px solid rgba(184, 156, 109, 0.2)',
              color: 'var(--accent-color)',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {draftSavedMessage}
            </div>
          )}

          {/* 一時保存フッター (Step 1〜5 の時に表示) */}
          {currentStep < 6 && (
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--neu-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleDraftSave}
                disabled={isSubmitting}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--accent-color)',
                  color: 'var(--accent-color)',
                  padding: '0.8rem 1.8rem',
                  boxShadow: 'none',
                  opacity: isSubmitting ? 0.6 : 1,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? '保存中...' : '一時保存（下書き）'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
