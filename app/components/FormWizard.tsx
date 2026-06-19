import { useState, useEffect } from 'react';
import type { FormData } from '../types/form';
import { initialFormData } from '../types/form';
import { Step1 } from './steps/Step1';
import { Step2 } from './steps/Step2';
import { Step3 } from './steps/Step3';
import { Step4 } from './steps/Step4';
import { Step5 } from './steps/Step5';
import { Step6 } from './steps/Step6';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export function FormWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentUser, refreshProjectData } = useAuth();

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
    const loadData = async () => {
      let dataLoaded = false;
      
      if (currentUser) {
        try {
          const docRef = doc(db, 'discovery_forms', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const firestoreData = docSnap.data().data as FormData;
            if (firestoreData) {
              setFormData(firestoreData);
              dataLoaded = true;
            }
          }
        } catch (e) {
          console.error('Failed to load form data from Firestore:', e);
        }
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
  }, [currentUser]);

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

  const handleSubmit = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      // discovery_forms に保存
      await setDoc(doc(db, 'discovery_forms', currentUser.uid), {
        data: formData,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        submittedAt: serverTimestamp(),
        status: 'submitted'
      });

      // projects の進行フェーズを更新する（ヒアリング完了 -> Phase 2: ワイヤーフレームへ）
      await setDoc(doc(db, 'projects', currentUser.uid), {
        currentPhase: 'Phase 2',
        hearingSubmitted: true,
        hearingSubmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // ローカルストレージをクリア
      localStorage.removeItem('designBoardFormData');
      localStorage.removeItem('designBoardStep');

      // プロジェクトデータを再読み込みしてダッシュボードに即時反映
      await refreshProjectData();
    } catch (e) {
      console.error('送信エラー:', e);
      throw e; // Step6 側でキャッチしてエラー表示などを行う
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) return null;

  return (
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
      <div className="neumorphic-panel" style={{ minHeight: '60vh' }}>
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

    </div>
  );
}
