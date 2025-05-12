function renderAttachmentHTML(path) {
  if (!path) return '';

  const lower = path.toLowerCase();

  if (lower.endsWith('.pdf')) {
    return `
      <div style="margin: 10px 0; padding: 8px; background: #f8f8f8; border-left: 4px solid #888;">
        📄 <a href="${path}" download style="text-decoration: none; font-weight: bold;">Download PDF</a>
      </div>`;
  }

  if (lower.match(/\.(jpg|jpeg|png)$/)) {
    return `
      <div style="margin: 10px 0;">
        <img src="${path}" alt="Attachment" style="max-width: 400px; display: block; border: 1px solid #ccc; padding: 4px;">
      </div>`;
  }

  return '';
}

module.exports = { renderAttachmentHTML };
