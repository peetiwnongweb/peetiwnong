const { getFileMetadata, downloadFileStream } = require('../lib/googleDrive');

// เสิร์ฟรูปภาพที่เก็บบน Google Drive แทนเว็บสาธารณะ (ดู backend/lib/driveImageStorage.js) - ไฟล์เก็บเป็น private บน Drive เสมอ
// ดึงด้วยสิทธิ์ของบัญชีที่ตั้งค่าไว้ ไม่ต้องเปิด "anyone with link" ให้ Drive เอง (กันปัญหา rate limit/หน้าเตือนไวรัสของ Drive)
// cache-control ยาวมาก เพราะชื่อไฟล์ไม่ซ้ำกันอยู่แล้ว (timestamp+random) เนื้อไฟล์จึงไม่มีวันเปลี่ยนตาม fileId เดิม - ลดจำนวนครั้งที่ต้องยิง Drive API ซ้ำ
async function serveMedia(req, res) {
  const { fileId } = req.params;
  try {
    const [metadata, stream] = await Promise.all([
      getFileMetadata(fileId),
      downloadFileStream(fileId),
    ]);
    res.setHeader('Content-Type', metadata.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    stream.on('error', (error) => {
      console.error('สตรีมไฟล์รูปภาพจาก Drive ไม่สำเร็จ:', error.message);
      if (!res.headersSent) res.status(502).end();
    });
    stream.pipe(res);
  } catch (error) {
    if (error.code === 404) return res.status(404).json({ error: 'ไม่พบไฟล์' });
    console.error('เสิร์ฟไฟล์รูปภาพไม่สำเร็จ:', error.message);
    res.status(502).json({ error: 'โหลดรูปภาพไม่สำเร็จ' });
  }
}

module.exports = { serveMedia };
