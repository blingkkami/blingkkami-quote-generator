import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Plus, Trash2, X } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

type QuoteItem = {
  id: string;
  category: string;
  description: string;
  price: number;
};

type QuoteForm = {
  quoteDate: string;
  validDuration: string;
  issuerName: string;
  projectName: string;
  deliveryFormat: string;
  deliverySchedule: string;
  finalCategory: string;
  finalDescription: string;
  notes: string;
  message: string;
  signOffSender: string;
  signOffDate: string;
};

const primary = '#3b2f7d';
const primaryLight = '#f3eff8';
const finalBg = '#e9e2f4';
const borderColor = '#e5e5e5';
const appVersion = '2026-05-18-quote-title';
const savedQuoteKey = 'blingkkami-quote-generator-state';

const defaultFormData: QuoteForm = {
  quoteDate: '2026-05-07',
  validDuration: '견적일로부터 14일',
  issuerName: '블링까미 스튜디오',
  projectName: 'BT THERA 에코패키지 디자인',
  deliveryFormat: 'AI 파일 (인쇄용)',
  deliverySchedule: '착수 후 10영업일 (5월 20일)',
  finalCategory: '최종 풀구성',
  finalDescription: '하짝 + 상짝 컬러변형 1종 + 신규 2종 + AI 파일 납품',
  notes:
    '기본안만 진행하실 경우 80,000원이며, 옵션은 필요한 항목만 선택 가능합니다.\n수정은 항목별 2회까지 포함됩니다. 그 이후 추가 수정이 필요하신 경우, 난이도에 따라 회당 20,000원부터 추가 비용이 발생할 수 있습니다.\n최종 납품 파일은 인쇄용 AI 파일로 제공됩니다.\n작업 착수 전 계약금 50% 선입금을 원칙으로 합니다. 입금 계좌 및 세금계산서(또는 현금영수증) 발행 관련 안내는 계약 확정 후 함께 전달드리겠습니다.\n본 견적서의 유효기간은 견적일로부터 14일입니다.',
  message:
    '이윤서 대표님 소개로 인연이 닿아 정말 반갑습니다.\n위 금액이 기준이지만, 혹시 내부 예산이 정해져 있으시면 편하게 말씀 주세요. 첫 거래인 만큼 최대한 맞춰 드리려고 합니다.\n앞으로도 패키지나 다른 디자인 작업 필요하실 때 언제든 편하게 연락 주세요. 좋은 파트너가 되겠습니다.',
  signOffSender: '블링까미 스튜디오 드림',
  signOffDate: '2026년 5월 7일',
};

const defaultItems: QuoteItem[] = [
  {
    id: 'base',
    category: '기본안',
    description: '하짝 3세트 적용, 제공 문구 배치, 로고/기본 표기 정리',
    price: 80000,
  },
  {
    id: 'option-1',
    category: '옵션 1',
    description: '상짝 컬러변형 1종 추가',
    price: 50000,
  },
  {
    id: 'option-2',
    category: '옵션 2',
    description: '상짝 신규 디자인 2종 전체 추가',
    price: 140000,
  },
];

const formatCurrency = (amount: number) => `${new Intl.NumberFormat('ko-KR').format(amount || 0)}원`;

const formatKoreanDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const [year, month, day] = value.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
};

const trimBottomWhitespace = (dataUrl: string): Promise<{ dataUrl: string; width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;

      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas context is unavailable.'));
        return;
      }

      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let contentBottom = canvas.height - 1;

      for (let y = canvas.height - 1; y >= 0; y -= 1) {
        let hasContent = false;
        for (let x = 0; x < canvas.width; x += 1) {
          const index = (y * canvas.width + x) * 4;
          const alpha = data[index + 3];
          const red = data[index];
          const green = data[index + 1];
          const blue = data[index + 2];

          if (alpha > 20 && (red < 248 || green < 248 || blue < 248)) {
            hasContent = true;
            break;
          }
        }

        if (hasContent) {
          contentBottom = y;
          break;
        }
      }

      const bottomPadding = 80;
      const trimmedHeight = Math.min(canvas.height, Math.max(1, contentBottom + bottomPadding));
      const trimmedCanvas = document.createElement('canvas');
      trimmedCanvas.width = canvas.width;
      trimmedCanvas.height = trimmedHeight;

      const trimmedContext = trimmedCanvas.getContext('2d');
      if (!trimmedContext) {
        reject(new Error('Canvas context is unavailable.'));
        return;
      }

      trimmedContext.fillStyle = '#ffffff';
      trimmedContext.fillRect(0, 0, trimmedCanvas.width, trimmedCanvas.height);
      trimmedContext.drawImage(canvas, 0, 0);
      resolve({
        dataUrl: trimmedCanvas.toDataURL('image/png'),
        width: trimmedCanvas.width,
        height: trimmedCanvas.height,
      });
    };
    image.onerror = () => reject(new Error('Could not load generated quote image.'));
    image.src = dataUrl;
  });

export default function App() {
  const previewRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewHeight, setPreviewHeight] = useState(1123);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [formData, setFormData] = useState<QuoteForm>(() => {
    const saved = localStorage.getItem(savedQuoteKey);
    if (!saved) return defaultFormData;

    try {
      return { ...defaultFormData, ...JSON.parse(saved).formData };
    } catch {
      return defaultFormData;
    }
  });
  const [items, setItems] = useState<QuoteItem[]>(() => {
    const saved = localStorage.getItem(savedQuoteKey);
    if (!saved) return defaultItems;

    try {
      return JSON.parse(saved).items || defaultItems;
    } catch {
      return defaultItems;
    }
  });

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.price || 0), 0), [items]);
  const total = Math.round(subtotal * 1.1);

  useEffect(() => {
    localStorage.setItem(savedQuoteKey, JSON.stringify({ formData, items }));
  }, [formData, items]);

  useEffect(() => {
    const container = previewContainerRef.current;
    const preview = previewRef.current;
    if (!container || !preview) return;

    const updatePreview = () => {
      const availableWidth = Math.max(320, container.clientWidth - 32);
      const availableHeight = Math.max(420, window.innerHeight - 136);
      setPreviewScale(Math.min(1, availableWidth / 794, availableHeight / 1123));
      setPreviewHeight(Math.max(1123, preview.offsetHeight));
    };

    updatePreview();
    const observer = new ResizeObserver(updatePreview);
    observer.observe(container);
    observer.observe(preview);
    window.addEventListener('resize', updatePreview);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePreview);
    };
  }, []);

  const updateForm = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const updateItem = (id: string, field: keyof QuoteItem, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === 'price' ? Number(value) : value,
            }
          : item,
      ),
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        category: '',
        description: '',
        price: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setLogoImage(String(reader.result));
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const downloadPdf = async () => {
    if (!previewRef.current) return;

    try {
      setIsGenerating(true);
      const node = previewRef.current;
      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        quality: 1,
        width: 794,
        height: node.offsetHeight,
      });
      const trimmedImage = await trimBottomWhitespace(dataUrl);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = (trimmedImage.height * pageWidth) / trimmedImage.width;
      const pageTolerance = 2;

      let heightLeft = imageHeight;
      let position = 0;

      pdf.addImage(trimmedImage.dataUrl, 'PNG', 0, position, pageWidth, imageHeight);
      heightLeft -= pageHeight;

      while (heightLeft > pageTolerance) {
        position = heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(trimmedImage.dataUrl, 'PNG', 0, position, pageWidth, imageHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`견적서_${formData.projectName || '프로젝트'}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#3b2f7d]" />
            <h1 className="text-lg font-bold">견적서 생성기</h1>
            <span className="sr-only">version {appVersion}</span>
          </div>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 rounded-md bg-[#3b2f7d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#302666] disabled:bg-[#a67dbf]"
          >
            <Download className="h-4 w-4" />
            {isGenerating ? 'PDF 생성 중' : 'PDF 다운로드'}
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 xl:grid-cols-[minmax(360px,520px)_1fr] sm:px-6 lg:px-8">
        <section className="space-y-5">
          <Panel title="로고">
            <div className="flex items-center gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100">
                <ImageIcon className="h-4 w-4" />
                로고 업로드
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="sr-only" />
              </label>
              {logoImage ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-28 items-center justify-center rounded-md border border-slate-200 bg-white p-2">
                    <img src={logoImage} alt="업로드한 로고" className="max-h-full max-w-full object-contain" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogoImage(null)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-red-600"
                    aria-label="로고 삭제"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <span className="text-sm text-slate-500">견적서 좌측 상단에 표시됩니다.</span>
              )}
            </div>
          </Panel>

          <Panel title="기본 정보">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="견적일" name="quoteDate" type="date" value={formData.quoteDate} onChange={updateForm} />
              <TextInput label="유효기간" name="validDuration" value={formData.validDuration} onChange={updateForm} />
              <TextInput label="공급자" name="issuerName" value={formData.issuerName} onChange={updateForm} />
              <TextInput label="프로젝트명" name="projectName" value={formData.projectName} onChange={updateForm} />
              <TextInput label="납품 형식" name="deliveryFormat" value={formData.deliveryFormat} onChange={updateForm} />
              <TextInput
                label="납기 예정"
                name="deliverySchedule"
                value={formData.deliverySchedule}
                onChange={updateForm}
              />
            </div>
          </Panel>

          <Panel title="작업 항목">
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-[120px_1fr_112px_36px]">
                    <input
                      aria-label="항목"
                      value={item.category}
                      onChange={(event) => updateItem(item.id, 'category', event.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="항목"
                    />
                    <input
                      aria-label="내용"
                      value={item.description}
                      onChange={(event) => updateItem(item.id, 'description', event.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="내용"
                    />
                    <input
                      aria-label="금액"
                      type="number"
                      value={item.price}
                      onChange={(event) => updateItem(item.id, 'price', event.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-red-600"
                      aria-label="항목 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                <Plus className="h-4 w-4" />
                항목 추가
              </button>
            </div>
          </Panel>

          <Panel title="최종 구성">
            <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
              <TextInput label="구분" name="finalCategory" value={formData.finalCategory} onChange={updateForm} />
              <TextInput label="내용" name="finalDescription" value={formData.finalDescription} onChange={updateForm} />
            </div>
          </Panel>

          <Panel title="유의사항 및 전달 말씀">
            <div className="space-y-4">
              <TextArea label="유의사항" name="notes" rows={7} value={formData.notes} onChange={updateForm} />
              <TextArea label="전달 말씀" name="message" rows={5} value={formData.message} onChange={updateForm} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="보낸 사람" name="signOffSender" value={formData.signOffSender} onChange={updateForm} />
                <TextInput label="작성일" name="signOffDate" value={formData.signOffDate} onChange={updateForm} />
              </div>
            </div>
          </Panel>
        </section>

        <section className="min-w-0">
          <div className="mb-3 text-sm font-semibold text-slate-600">미리보기</div>
          <div ref={previewContainerRef} className="rounded-md border border-slate-200 bg-slate-200 p-4">
            <div
              className="mx-auto"
              style={{
                width: `${794 * previewScale}px`,
                height: `${previewHeight * previewScale}px`,
              }}
            >
              <div className="origin-top-left" style={{ width: 794, transform: `scale(${previewScale})` }}>
                <QuotePreview
                  ref={previewRef}
                  formData={formData}
                  items={items}
                  logoImage={logoImage}
                  subtotal={subtotal}
                  total={total}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const QuotePreview = React.forwardRef<
  HTMLDivElement,
  {
    formData: QuoteForm;
    items: QuoteItem[];
    logoImage: string | null;
    subtotal: number;
    total: number;
  }
>(({ formData, items, logoImage, subtotal, total }, ref) => (
  <div
    ref={ref}
    className="mx-auto min-h-[1123px] w-[794px] bg-white px-[50px] py-[60px] text-black shadow-sm"
    style={{ boxSizing: 'border-box' }}
  >
    <div className="relative text-center">
      {logoImage && (
        <div className="absolute left-0 top-0 flex h-[64px] w-[189px] items-center justify-start">
          <img src={logoImage} alt="회사 로고" className="max-h-full max-w-full object-contain" />
        </div>
      )}
      <h2 className="ml-[0.2em] text-[36px] font-black tracking-[0.42em]" style={{ color: primary }}>
        견적서
      </h2>
      <p className="mt-2 text-[14px] tracking-[0.08em]" style={{ color: primary }}>
        QUOTATION
      </p>
      <div className="mt-4 h-px w-full" style={{ backgroundColor: primary }} />
    </div>

    <PreviewSection title="기본 정보">
      <table className="w-full border-collapse border text-[12px]" style={{ borderColor }}>
        <tbody>
          <InfoRow
            leftLabel="견적일"
            leftValue={formatKoreanDate(formData.quoteDate)}
            rightLabel="유효기간"
            rightValue={formData.validDuration}
          />
          <InfoRow
            leftLabel="공급자"
            leftValue={formData.issuerName}
            rightLabel="프로젝트명"
            rightValue={formData.projectName}
          />
          <InfoRow
            leftLabel="납품 형식"
            leftValue={formData.deliveryFormat}
            rightLabel="납기 예정"
            rightValue={formData.deliverySchedule}
            isLast
          />
        </tbody>
      </table>
    </PreviewSection>

    <PreviewSection title="작업 항목 (옵션형)">
      <table className="w-full border-collapse border text-[12px]" style={{ borderColor }}>
        <thead>
          <tr style={{ backgroundColor: primary, color: 'white' }}>
            <th className="w-[20%] border-r px-3 py-2 font-bold" style={{ borderColor }}>
              항목
            </th>
            <th className="w-[60%] border-r px-3 py-2 font-bold" style={{ borderColor }}>
              내용
            </th>
            <th className="w-[20%] px-3 py-2 font-bold">금액</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b" style={{ borderColor }}>
              <td className="border-r px-3 py-2 text-center font-bold" style={{ borderColor }}>
                {item.category || '-'}
              </td>
              <td className="border-r px-3 py-2 text-gray-800" style={{ borderColor }}>
                {item.description || '-'}
              </td>
              <td className="px-3 py-2 text-right">{formatCurrency(item.price)}</td>
            </tr>
          ))}
          <tr style={{ backgroundColor: finalBg }}>
            <td className="border-r px-3 py-2.5 text-center font-bold" style={{ color: primary, borderColor }}>
              {formData.finalCategory}
            </td>
            <td className="border-r px-3 py-2.5 font-bold" style={{ color: primary, borderColor }}>
              {formData.finalDescription}
            </td>
            <td className="px-3 py-2 text-right">
              <span className="block text-[14px] font-bold" style={{ color: primary }}>
                {formatCurrency(subtotal)}
              </span>
              <span className="text-[10px] text-gray-500">부가세 별도</span>
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border-r px-4 py-2 text-right text-[11px] text-gray-600" style={{ borderColor }}>
              <div>총 견적 (부가세 제외) : {formatCurrency(subtotal)}</div>
              <div>총 견적 (부가세 포함) : {formatCurrency(total)}</div>
            </td>
            <td className="bg-[#f9f9f9]" />
          </tr>
        </tbody>
      </table>
    </PreviewSection>

    <PreviewSection title="유의사항">
      <ul className="list-inside list-disc space-y-1 px-3 py-2 text-[12px] leading-[1.8] text-gray-700">
        {formData.notes
          .split('\n')
          .filter((note) => note.trim())
          .map((note, index) => (
            <li key={index}>{note.replace(/^[·\-\*]\s*/, '')}</li>
          ))}
      </ul>
    </PreviewSection>

    <PreviewSection title="전달 말씀">
      <div
        className="border border-t-0 px-10 py-6 text-left text-[12px] leading-[1.9] text-gray-800"
        style={{ borderColor, backgroundColor: '#f8f5fc' }}
      >
        <p className="whitespace-pre-wrap">{formData.message}</p>
      </div>
    </PreviewSection>

    <div className="mt-5 pr-4 text-right">
      <div className="text-[15px] font-bold" style={{ color: primary }}>
        {formData.signOffSender}
      </div>
      <div className="mt-1 text-[12px] text-gray-500">{formData.signOffDate}</div>
    </div>
  </div>
));

QuotePreview.displayName = 'QuotePreview';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-bold">{title}</h2>
      {children}
    </div>
  );
}

function TextInput({
  label,
  name,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#3b2f7d] focus:ring-2 focus:ring-[#f3eff8]"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  rows,
  value,
  onChange,
}: {
  label: string;
  name: string;
  rows: number;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        name={name}
        rows={rows}
        value={value}
        onChange={onChange}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#3b2f7d] focus:ring-2 focus:ring-[#f3eff8]"
      />
    </label>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 ml-1 text-[16px] font-bold" style={{ color: primary }}>
        {title}
      </h3>
      <div className="h-[2px] w-full" style={{ backgroundColor: primary }} />
      {children}
    </section>
  );
}

function InfoRow({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  isLast = false,
}: {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
  isLast?: boolean;
}) {
  return (
    <tr className={isLast ? '' : 'border-b'} style={{ borderColor }}>
      <InfoCell label={leftLabel} />
      <td className="w-[32%] border-r px-3 py-2.5 text-gray-800" style={{ borderColor }}>
        {leftValue}
      </td>
      <InfoCell label={rightLabel} />
      <td className="w-[32%] px-3 py-2.5 text-gray-800">{rightValue}</td>
    </tr>
  );
}

function InfoCell({ label }: { label: string }) {
  return (
    <td
      className="w-[18%] border-r px-3 py-2.5 text-center font-bold"
      style={{ backgroundColor: primaryLight, color: primary, borderColor }}
    >
      {label}
    </td>
  );
}
