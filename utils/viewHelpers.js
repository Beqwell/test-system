function renderAttachmentHTML(path) {
  if (!path) return '';

  const lower = path.toLowerCase();

  if (lower.endsWith('.pdf')) {
    return `<div style="margin: 10px 0;">📄 <a href="${path}" target="_blank">Download PDF</a></div>`;
  }

  if (lower.match(/\.(jpg|jpeg|png)$/)) {
    return `<div style="margin: 10px 0;"><img src="${path}" style="max-width: 300px; display: block;" alt="Attachment"></div>`;
  }

  return '';
}

module.exports = { renderAttachmentHTML };
