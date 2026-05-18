// Code.gs (Google Apps Script 백엔드 코드)

/**
 * Web App 접속 시 HTML 페이지를 렌더링합니다.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Blingkkami 견적서 생성기')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 클라이언트(프론트엔드)에서 전달받은 데이터로 PDF를 생성하고 시트에 저장합니다.
 * @param {Object} formData 클라이언트에서 넘겨준 견적서 데이터
 * @returns {Object} 생성된 PDF의 URL 또는 에러 메시지
 */
function generateQuotePDF(formData) {
  try {
    // ==========================================
    // [설정] 본인의 구글 드라이브 ID로 변경하세요.
    // ==========================================
    const TEMPLATE_DOC_ID = '여기에_구글_문서_템플릿_ID를_입력하세요'; 
    const OUTPUT_FOLDER_ID = '여기에_PDF가_저장될_폴더_ID를_입력하세요';
    const SHEET_ID = '여기에_데이터를_저장할_구글_시트_ID를_입력하세요';
    
    // 1) 템플릿 문서 복사
    const templateDoc = DriveApp.getFileById(TEMPLATE_DOC_ID);
    const outputFolder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
    const newDocFile = templateDoc.makeCopy(`견적서_${formData.clientCompany}_${formData.quoteNumber}`, outputFolder);
    const newDoc = DocumentApp.openById(newDocFile.getId());
    const body = newDoc.getBody();
    
    // 2) 자리표시자(Placeholder) 데이터 교체
    // Docs 템플릿 내에 {{태그명}} 형태로 작성해두어야 합니다.
    body.replaceText('{{quote_number}}', formData.quoteNumber || '');
    body.replaceText('{{quote_date}}', formData.quoteDate || '');
    body.replaceText('{{issuer_name}}', formData.issuerName || '');
    body.replaceText('{{issuer_phone}}', formData.issuerPhone || '');
    body.replaceText('{{issuer_email}}', formData.issuerEmail || '');
    
    body.replaceText('{{client_company}}', formData.clientCompany || '');
    body.replaceText('{{client_manager}}', formData.clientManager || '');
    body.replaceText('{{project_name}}', formData.projectName || '');
    body.replaceText('{{service_name}}', formData.serviceName || '');
    body.replaceText('{{scope}}', formData.scope || '');
    
    body.replaceText('{{unit_price}}', Number(formData.unitPrice).toLocaleString('ko-KR'));
    body.replaceText('{{quantity}}', formData.quantity.toString());
    body.replaceText('{{subtotal}}', Number(formData.subtotal).toLocaleString('ko-KR'));
    body.replaceText('{{discount}}', Number(formData.discountAmount).toLocaleString('ko-KR'));
    body.replaceText('{{final_subtotal}}', Number(formData.finalSubtotal).toLocaleString('ko-KR'));
    body.replaceText('{{vat}}', Number(formData.vat).toLocaleString('ko-KR'));
    body.replaceText('{{total_amount}}', Number(formData.grandTotal).toLocaleString('ko-KR'));
    body.replaceText('{{due_date}}', formData.dueDate || '');
    body.replaceText('{{payment_terms}}', formData.paymentTermsText || '');
    
    newDoc.saveAndClose();
    
    // 3) PDF로 변환
    const pdfBlob = newDocFile.getAs(MimeType.PDF);
    const pdfFile = outputFolder.createFile(pdfBlob);
    
    // 4) 임시 복사된 구글 문서 삭제 (PDF만 남기기)
    newDocFile.setTrashed(true);
    
    // 5) 구글 시트에 기록 남기기
    try {
      const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
      sheet.appendRow([
        new Date(),
        formData.quoteNumber,
        formData.clientCompany,
        formData.projectName,
        formData.grandTotal,
        pdfFile.getUrl()
      ]);
    } catch (sheetError) {
      console.error("시트 저장 실패:", sheetError);
      // 시트 저장이 실패해도 PDF 생성은 완료되었으므로 계속 진행
    }
    
    // 6) 생성된 PDF 다운로드 URL 반환
    return {
      success: true,
      pdfUrl: pdfFile.getDownloadUrl(),
      viewUrl: pdfFile.getUrl()
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}
