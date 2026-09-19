import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// WEBMANAGER คือเจ้าของระบบ สิทธิ์สูงสุด แยกออกจาก Admin โดยสิ้นเชิง มีหน้า login และแผงควบคุมของตัวเองที่ /webmanager
// บัญชีแรกคือบัญชีจริงของเจ้าของระบบ ส่วนบัญชีที่สองเป็นบัญชีทดสอบ (mockup) ไว้ล็อกอินทดสอบหน้า /webmanager/login.html โดยไม่ต้องใช้บัญชีจริง
// WEBMANAGER ไม่มีตาราง Profile แยก (ไม่มีชื่อ-นามสกุล) มีแค่รูปโปรไฟล์ (avatarUrl) ให้ใส่ในวงกลมแทนตัวอักษรย่อ
const users = [
  { email: 'webmanager.demo@peetiwnong.camp', password: 'webmanager123', role: 'WEBMANAGER', avatar: '/assets/images/avatars/webmanager/1.png' },
];

// ฝ่ายงานของค่าย ใช้เป็นตัวกรองเมนู "งาน" ในหน้าพี่ค่าย (ต้องตรงกับชื่อฝ่ายที่มีอยู่จริงในตาราง camp_departments)
const departmentNames = [
  'ฝ่ายวิชาการ',
  'ฝ่ายกิจกรรมและสันทนาการ',
  'ฝ่ายปกครองบริการและอาคารสถานที่',
  'ฝ่ายเทคโนโลยีและประชาสัมพันธ์',
  'ฝ่ายงานพยาบาล',
];

// ตำแหน่งพี่ค่าย: 3 ตำแหน่งผู้บริหารเห็นเมนู "งาน" ครบทุกฝ่าย ส่วนหัวหน้าฝ่าย/ทีมงานเห็นเฉพาะฝ่ายที่สังกัด
const positionNames = ['ประธานค่าย', 'รองประธานค่าย', 'เลขานุการ', 'หัวหน้าฝ่าย', 'ทีมงานค่าย'];

// รูปแบบคอร์สเรียนในค่าย ใช้ตอนน้องค่ายลงทะเบียน/แก้ไขโปรไฟล์ (ต้องตรงกับตัวเลือกในฟอร์มลงทะเบียน)
const courseFormatNames = ['คอร์สปรับพื้นฐาน', 'คอร์สเตรียมสอบ'];

// บัญชีทดสอบ STAFF ครบทุกตำแหน่ง/ฝ่าย สำหรับทดสอบการแสดงเมนู "งาน" ตามสิทธิ์
// ตั้งชื่อสมมติให้เป็นชื่อคนจริง ๆ แยกจากกันชัดเจน (ไม่ใช้ชื่อ = ตำแหน่งซ้ำกับคอลัมน์ position เพราะจะดูสับสนเวลาไล่ตาราง)
// สิทธิ์ผู้ดูแลระบบ (isAdmin) ให้ไว้กับ 3 ตำแหน่งผู้บริหาร (ประธาน/รองประธาน/เลขานุการ) เป็นค่าเริ่มต้น ส่วนคนอื่นมอบสิทธิ์เพิ่มได้ภายหลังผ่านหน้าแอดมิน
const staffMockups = [
  { email: 'president@peetiwnong.camp', password: 'staff123', prefix: 'นาย', academicTitle: 'ดร.', firstName: 'ธีรภัทร', lastName: 'หว่านนา', nickname: 'การ์ตูน', birthDate: '1999-03-15', phone: '0812345671', affiliation: 'มหาวิทยาลัยราชภัฏชัยภูมิ', occupation: 'ครู', avatar: '/assets/images/avatars/staff/1.png', position: 'ประธานค่าย', department: null, isAdmin: true },
  { email: 'vicepresident@peetiwnong.camp', password: 'staff123', prefix: 'นาย', academicTitle: 'ผศ.', firstName: 'ณัฐวุฒิ', lastName: 'ใจดี', nickname: 'บอล', birthDate: '1999-07-22', phone: '0823456782', affiliation: 'มหาวิทยาลัยขอนแก่น', occupation: 'วิศวกรซอฟต์แวร์', avatar: '/assets/images/avatars/staff/2.png', position: 'รองประธานค่าย', department: null, isAdmin: true },
  { email: 'secretary@peetiwnong.camp', password: 'staff123', prefix: 'นางสาว', academicTitle: 'อาจารย์', firstName: 'สุพิชญา', lastName: 'แสนดี', nickname: 'มายด์', birthDate: '2000-01-10', phone: '0834567893', affiliation: 'มหาวิทยาลัยเทคโนโลยีสุรนารี', occupation: 'นักศึกษาปริญญาโท', avatar: '/assets/images/avatars/staff/3.png', position: 'เลขานุการ', department: null, isAdmin: true },
  { email: 'head.academic@peetiwnong.camp', password: 'staff123', prefix: 'นาย', academicTitle: 'รศ.ดร.', firstName: 'กิตติพงษ์', lastName: 'ศรีสุข', nickname: 'ต้น', birthDate: '1995-05-18', phone: '0845678904', affiliation: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี', occupation: 'อาจารย์', avatar: '/assets/images/avatars/staff/4.png', position: 'หัวหน้าฝ่าย', department: 'ฝ่ายวิชาการ' },
  { email: 'head.activity@peetiwnong.camp', password: 'staff123', prefix: 'นางสาว', academicTitle: '', firstName: 'ปวีณา', lastName: 'รุ่งเรือง', nickname: 'พลอย', birthDate: '2000-09-05', phone: '0856789015', affiliation: 'มหาวิทยาลัยศิลปากร', occupation: 'นักออกแบบกิจกรรม', avatar: '/assets/images/avatars/staff/5.png', position: 'หัวหน้าฝ่าย', department: 'ฝ่ายกิจกรรมและสันทนาการ' },
  { email: 'head.discipline@peetiwnong.camp', password: 'staff123', prefix: 'นาย', academicTitle: '', firstName: 'ธนกร', lastName: 'มั่นคง', nickname: 'บิ๊ก', birthDate: '1998-11-30', phone: '0867890126', affiliation: 'มหาวิทยาลัยเกษตรศาสตร์', occupation: 'เจ้าหน้าที่ความปลอดภัย', avatar: '/assets/images/avatars/staff/6.png', position: 'หัวหน้าฝ่าย', department: 'ฝ่ายปกครองบริการและอาคารสถานที่' },
  { email: 'head.tech@peetiwnong.camp', password: 'staff123', prefix: 'นางสาว', academicTitle: '', firstName: 'ณัฐนรี', lastName: 'ธนโชติ', nickname: 'แนน', birthDate: '1999-12-12', phone: '0878901237', affiliation: 'มหาวิทยาลัยธรรมศาสตร์', occupation: 'นักการตลาดดิจิทัล', avatar: '/assets/images/avatars/staff/7.png', position: 'หัวหน้าฝ่าย', department: 'ฝ่ายเทคโนโลยีและประชาสัมพันธ์' },
  { email: 'staff.academic@peetiwnong.camp', password: 'staff123', prefix: 'นางสาว', academicTitle: '', firstName: 'อรวรรณ', lastName: 'ใจงาม', nickname: 'อ้อม', birthDate: '2002-02-14', phone: '0889012348', affiliation: 'มหาวิทยาลัยราชภัฏชัยภูมิ', occupation: 'นักศึกษาคณะครุศาสตร์', avatar: '/assets/images/avatars/staff/1.png', position: 'ทีมงานค่าย', department: 'ฝ่ายวิชาการ' },
  { email: 'staff.activity@peetiwnong.camp', password: 'staff123', prefix: 'นาย', academicTitle: '', firstName: 'ภานุวัฒน์', lastName: 'สว่างวงศ์', nickname: 'เต้ย', birthDate: '2001-06-25', phone: '0890123459', affiliation: 'มหาวิทยาลัยขอนแก่น', occupation: 'นักศึกษาคณะศึกษาศาสตร์', avatar: '/assets/images/avatars/staff/2.png', position: 'ทีมงานค่าย', department: 'ฝ่ายกิจกรรมและสันทนาการ' },
  { email: 'staff.discipline@peetiwnong.camp', password: 'staff123', prefix: 'นาย', academicTitle: '', firstName: 'จิรายุ', lastName: 'พิทักษ์', nickname: 'อาร์ม', birthDate: '2001-04-08', phone: '0901234560', affiliation: 'มหาวิทยาลัยมหาสารคาม', occupation: 'นักศึกษาคณะรัฐศาสตร์', avatar: '/assets/images/avatars/staff/3.png', position: 'ทีมงานค่าย', department: 'ฝ่ายปกครองบริการและอาคารสถานที่' },
  { email: 'staff.tech@peetiwnong.camp', password: 'staff123', prefix: 'นางสาว', academicTitle: '', firstName: 'ศศิธร', lastName: 'วัฒนกิจ', nickname: 'มิ้นท์', birthDate: '2002-10-19', phone: '0912345671', affiliation: 'มหาวิทยาลัยเทคโนโลยีสุรนารี', occupation: 'นักศึกษาคณะวิศวกรรมศาสตร์', avatar: '/assets/images/avatars/staff/4.png', position: 'ทีมงานค่าย', department: 'ฝ่ายเทคโนโลยีและประชาสัมพันธ์' },
  { email: 'head.nurse@peetiwnong.camp', password: 'staff123', prefix: 'นางสาว', academicTitle: '', firstName: 'ปิยะดา', lastName: 'บุญเรือง', nickname: 'หมิว', birthDate: '1997-08-21', phone: '0923456782', affiliation: 'วิทยาลัยพยาบาลบรมราชชนนี นครราชสีมา', occupation: 'พยาบาลวิชาชีพ', avatar: '/assets/images/avatars/staff/5.png', position: 'หัวหน้าฝ่าย', department: 'ฝ่ายงานพยาบาล' },
];

// กลุ่มน้องค่าย ปกติแอดมินเป็นคนสร้าง/จัดกลุ่มทีหลัง ที่นี่สร้างไว้ 1 กลุ่มเพื่อทดสอบหน้า "กิจกรรม" (ดูรายชื่อเพื่อนร่วมกลุ่ม)
const groupNames = ['กลุ่ม 1'];

// บัญชีทดสอบ PARTICIPANT สำหรับทดสอบหน้าน้องค่าย (หน้าแรก/โปรไฟล์/กิจกรรม) 3 คนแรกอยู่กลุ่มเดียวกันเพื่อทดสอบรายชื่อสมาชิกกลุ่ม
const participantMockups = [
  { email: 'participant.demo@peetiwnong.camp', password: 'participant123', prefix: 'นาย', firstName: 'ปณิธาน', lastName: 'ศรีวิไล', nickname: 'ปัน', birthDate: '2008-05-12', phone: '0934567890', parentPhone: '0945678901', avatar: '/assets/images/avatars/staff/6.png', courseFormat: 'คอร์สปรับพื้นฐาน', studyPlan: 'SCIENCE_MATH', interestSubjectGroup: 'ENGINEERING_TECH', dreamInstitution: 'คณะวิศวกรรมศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย', group: 'กลุ่ม 1' },
  { email: 'participant.demo2@peetiwnong.camp', password: 'participant123', prefix: 'นางสาว', firstName: 'กมลชนก', lastName: 'ทองดี', nickname: 'มายด์', birthDate: '2008-02-20', phone: '0956789012', parentPhone: '0967890123', avatar: '/assets/images/avatars/staff/7.png', courseFormat: 'คอร์สปรับพื้นฐาน', studyPlan: 'SCIENCE_MATH', interestSubjectGroup: 'HEALTH', dreamInstitution: 'คณะแพทยศาสตร์ มหาวิทยาลัยขอนแก่น', group: 'กลุ่ม 1' },
  { email: 'participant.demo3@peetiwnong.camp', password: 'participant123', prefix: 'นาย', firstName: 'ธนวัฒน์', lastName: 'ใจซื่อ', nickname: 'บอส', birthDate: '2007-11-03', phone: '0978901234', parentPhone: '0989012345', avatar: '/assets/images/avatars/staff/1.png', courseFormat: 'คอร์สเตรียมสอบ', studyPlan: 'ARTS_LANGUAGE', interestSubjectGroup: 'HUMANITIES_SOCIAL', dreamInstitution: 'คณะอักษรศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย', group: 'กลุ่ม 1' },
];

// CampDepartment/StaffPosition ไม่มี unique constraint บน name จึงต้อง find-or-create เอง เพื่อให้ seed รันซ้ำได้โดยไม่สร้างข้อมูลซ้ำ
async function findOrCreateByName(model, name) {
  const existing = await model.findFirst({ where: { name } });
  if (existing) return existing;
  return model.create({ data: { name } });
}

const committees = Array.from({ length: 28 }, (_, index) => ({
  generationNos: [index + 1],
  fullName: 'นายธีรภัทร หว่านนา',
  nickname: 'พี่การ์ตูน',
  imageUrl: '/backend/uploads/presidents/profile.jpg',
}));

const news = [
  {
    tag: 'ANNOUNCE',
    title: 'เปิดลงทะเบียนเข้าร่วมค่ายวิชาการ Academy Camp อย่างเป็นทางการ!',
    summary: 'เริ่มเปิดรับสมัครตั้งแต่วันนี้ถึง 31 สิงหาคม 2569 โควตามีจำนวนจำกัดในแต่ละกลุ่มการเรียนรู้',
    detail: `เปิดรับสมัครค่ายวิชาการเพื่อการพัฒนาทักษะแห่งอนาคต ประจำปี 2026 อย่างเป็นทางการแล้ววันนี้!<br><br>
    สำหรับโครงการในปีนี้ เรามุ่งเน้นเสริมสร้างศักยภาพเพื่อการก้าวสู่อนาคต โดยเปิดรับสมัครน้อง ๆ ระดับชั้น ม.ปลาย (ม.4 - ม.6) หรือเทียบเท่า ที่มีความสนใจใฝ่รู้ในด้านเทคโนโลยี วิทยาศาสตร์ และการคิดวิเคราะห์อย่างเป็นระบบ เพื่อมาศึกษาและแลกเปลี่ยนความรู้ในแคมป์ระดับประเทศ<br><br>
    <strong>กำหนดการสำคัญ:</strong><br>
    - ระยะเวลารับสมัคร: 1 กรกฎาคม – 31 สิงหาคม 2569<br>
    - ประกาศผลผู้มีสิทธิ์เข้าร่วมค่าย: 5 กันยายน 2569<br>
    - วันจัดค่ายจริง: 12 - 14 กันยายน 2569 (รวม 3 วัน 2 คืน ณ อาคารนวัตกรรมสถาบันวิจัยการเรียนรู้)<br><br>
    สิทธิ์ความต้องการเข้าร่วมกลุ่มวิชาการจะเรียงลำดับตามความน่าสนใจและประวัติเพื่อรับทุนการศึกษาหรือสิทธิ์ยืนยันตัวตนด่วน`,
    imageUrl: '/backend/uploads/news/news.jpg',
    isHot: true,
    publishedAt: new Date('2026-07-02'),
  },
  {
    tag: 'ACTIVITY',
    title: 'อัปเดตรายชื่อวิทยากรรับเชิญประจำปีนี้ ดร. และผู้เชี่ยวชาญจาก Tech Company',
    summary: 'เปิดเผยรายชื่อพี่เลี้ยงและทีมอาจารย์จากมหาวิทยาลัยชั้นนำที่จะคอยดูแลให้คำแนะนำน้อง ๆ ตลอดค่าย',
    detail: `พบกับวิทยากรชั้นนำที่จะมาร่วมแบ่งปันประสบการณ์จริงในค่ายวิชาการ Academy Camp รุ่นที่ 12:<br><br>
    <strong>1. ดร.กิตติพงษ์ ศรีสุข (เชี่ยวชาญด้านปัญญาประดิษฐ์และ AI จากบริษัทชั้นนำประเทศ)</strong><br>
    จะมานำทีมจัดกิจกรรมเวิร์กช็อปการเขียนโค้ดและโมเดลประดิษฐ์สัญกรณ์อัจฉริยะแบบไร้ขีดจำกัด<br><br>
    <strong>2. คุณณัฐนรี ธนโชติ (ผู้ร่วมก่อตั้ง Startup ด้านการออกแบบเทคโนโลยี)</strong><br>
    ที่จะเปิดโลกธุรกิจนวัตกรรม แผนพัฒนาผลิตภัณฑ์ และวิธีการคิดแบบจำลอง Design Thinking เพื่อนำไปปรับใช้ในวิชาชีพ<br><br>
    <strong>3. ดร.สมเกียรติ มั่นคง (อาจารย์คณะวิศวกรรมศาสตร์ มหาวิทยาลัยเทคโนโลยีชื่อดัง)</strong><br>
    มาเสริมทักษะด้านฮาร์ดแวร์ การจัดการหุ่นยนต์ และไมโครคอนโทรลเลอร์`,
    imageUrl: '/backend/uploads/news/news.jpg',
    isHot: false,
    publishedAt: new Date('2026-06-28'),
  },
  {
    tag: 'SCHOLAR',
    title: 'การจัดสรรทุนการศึกษาช่วยเหลือสำหรับน้อง ๆ ที่ขาดแคลน',
    summary: 'ผู้ที่มีผลการเรียนเด่นหรือมีเจตนารมณ์ที่ดี สามารถยื่นขอทุนการศึกษาค่าที่พักและค่าเดินทางฟรีตลอดกิจกรรม',
    detail: `เพื่อส่งเสริมความเสมอภาคในการศึกษา ค่ายวิชาการ Academy Camp ประจำปี 2026 ได้ร่วมกับผู้สนับสนุนใจดี จัดเตรียม<strong>ทุนช่วยเหลือพิเศษจำนวน 15 ทุน</strong> สำหรับน้อง ๆ ที่มีคุณสมบัติต่อไปนี้:<br><br>
    1. กำลังศึกษาอยู่ในระดับชั้นมัธยมศึกษาตอนปลายหรือเทียบเท่าทั่วประเทศ<br>
    2. ขาดแคลนทุนทรัพย์ด้านค่าที่เดินทางและอาหารในการเดินทางมาร่วมค่ายที่กรุงเทพฯ<br>
    3. มีความประพฤติดี มุ่งมั่น สนใจสายวิชาที่เลือกอย่างแท้จริง<br><br>
    <strong>สิทธิประโยชน์ของทุน:</strong> ฟรีค่าเอกสาร เสื้อค่าย, ทุนสนับสนุนค่ารถบัส/รถไฟสำหรับผู้ที่เดินทางจากต่างจังหวัด, และที่พักฟรีแบบส่วนตัว 2 คืน (มีทีมงานดูแลอย่างปลอดภัย)<br><br>
    ผู้สนใจสามารถกรอกฟอร์มขอพิจารณาทุนตอนลงทะเบียนและจัดส่งข้อมูลการสมัครได้ตั้งแต่วันนี้`,
    imageUrl: '/backend/uploads/news/news.jpg',
    isHot: false,
    publishedAt: new Date('2026-06-25'),
  },
  {
    tag: 'OTHER',
    title: 'เตรียมความพร้อมก่อนเข้าค่าย: อุปกรณ์ที่จำเป็นและแนวทางปฏิบัติ',
    summary: 'กรุณาเตรียมสมุดบันทึก ยาสามัญส่วนตัว และคอมพิวเตอร์พกพาสำหรับการเข้าใช้แอปพลิเคชันและเวิร์กช็อป',
    detail: `เพื่อความราบรื่นตลอดการเข้าร่วมแคมป์ คณะกรรมการฝ่ายจัดเตรียมสถานที่ขอความกรุณาให้น้อง ๆ ทุกคนปฏิบัติดังนี้:<br><br>
    - <strong>เครื่องคอมพิวเตอร์พกพา (Laptop):</strong> จำเป็นมากสำหรับสายวิทยาการคอมพิวเตอร์และธุรกิจ เพื่อใช้พิมพ์โค้ดและตกแต่งหน้าโปรเจกต์ (หากใครไม่มีจริงๆ ให้ติดต่อทีมงานในขั้นตอนยืนยันสิทธิ์เพื่อขอยืมใช้งานชั่วคราวได้ครับ)<br>
    - <strong>เครื่องแต่งกาย:</strong> ชุดไปรเวทสุภาพ สะดวกในการทำกิจกรรมลุยๆ และมีเสื้อแจ็คเก็ตกันหนาว เนื่องจากห้องแอร์จะมีความเย็นพอสมควร<br>
    - <strong>เอกสารทางการแพทย์:</strong> ข้อมูลอาการแพ้ส่วนตัว ตลอดจนยาประจำตัว`,
    imageUrl: '/backend/uploads/news/news.jpg',
    isHot: false,
    publishedAt: new Date('2026-06-15'),
  },
];

async function main() {
  // หมายเหตุ: committees ไม่มี unique constraint แล้ว (generationNos เป็น array) skipDuplicates จึงไม่ช่วยกันรันซ้ำสร้างข้อมูลซ้ำเหมือนเดิม
  await prisma.committee.createMany({ data: committees, skipDuplicates: true });
  await prisma.news.createMany({ data: news, skipDuplicates: true });

  const departmentRecords = {};
  for (const name of departmentNames) {
    departmentRecords[name] = await findOrCreateByName(prisma.campDepartment, name);
  }

  const positionRecords = {};
  for (const name of positionNames) {
    positionRecords[name] = await findOrCreateByName(prisma.staffPosition, name);
  }

  const courseFormatRecords = {};
  for (const name of courseFormatNames) {
    courseFormatRecords[name] = await findOrCreateByName(prisma.courseFormat, name);
  }

  const groupRecords = {};
  for (const name of groupNames) {
    groupRecords[name] = await findOrCreateByName(prisma.group, name);
  }

  // seed พี่ค่ายทดสอบก่อน users พื้นฐาน (Host) เพื่อให้ user_id กับ staff_profiles.id เรียงตรงกัน (1-11) บนฐานข้อมูลว่าง
  for (const mock of staffMockups) {
    const passwordHash = await bcrypt.hash(mock.password, 10);
    const user = await prisma.user.upsert({
      where: { email: mock.email },
      update: { avatarUrl: mock.avatar },
      create: { email: mock.email, passwordHash, role: 'STAFF', avatarUrl: mock.avatar },
    });

    await prisma.staffProfile.upsert({
      where: { userId: user.id },
      update: {
        prefix: mock.prefix,
        academicTitle: mock.academicTitle,
        firstName: mock.firstName,
        lastName: mock.lastName,
        nickname: mock.nickname,
        birthDate: new Date(mock.birthDate),
        phone: mock.phone,
        affiliation: mock.affiliation,
        occupation: mock.occupation,
        positionId: positionRecords[mock.position].id,
        departmentId: mock.department ? departmentRecords[mock.department].id : null,
        isAdmin: mock.isAdmin || false,
      },
      create: {
        userId: user.id,
        prefix: mock.prefix,
        academicTitle: mock.academicTitle,
        firstName: mock.firstName,
        lastName: mock.lastName,
        nickname: mock.nickname,
        birthDate: new Date(mock.birthDate),
        phone: mock.phone,
        affiliation: mock.affiliation,
        occupation: mock.occupation,
        positionId: positionRecords[mock.position].id,
        departmentId: mock.department ? departmentRecords[mock.department].id : null,
        isAdmin: mock.isAdmin || false,
      },
    });
  }

  for (const mock of participantMockups) {
    const passwordHash = await bcrypt.hash(mock.password, 10);
    const user = await prisma.user.upsert({
      where: { email: mock.email },
      update: { avatarUrl: mock.avatar },
      create: { email: mock.email, passwordHash, role: 'PARTICIPANT', avatarUrl: mock.avatar },
    });

    const profileData = {
      prefix: mock.prefix,
      firstName: mock.firstName,
      lastName: mock.lastName,
      nickname: mock.nickname,
      birthDate: new Date(mock.birthDate),
      phone: mock.phone,
      parentPhone: mock.parentPhone,
      courseFormatId: courseFormatRecords[mock.courseFormat].id,
      studyPlan: mock.studyPlan,
      interestSubjectGroup: mock.interestSubjectGroup,
      dreamInstitution: mock.dreamInstitution,
      groupId: mock.group ? groupRecords[mock.group].id : null,
    };

    await prisma.participantProfile.upsert({
      where: { userId: user.id },
      update: profileData,
      create: { userId: user.id, ...profileData },
    });
  }

  // upsert แทน createMany เพื่อให้รันซ้ำได้โดยอัปเดต avatarUrl ของบัญชีเดิมด้วย (createMany + skipDuplicates จะข้ามบัญชีที่มีอยู่แล้วไปเฉย ๆ ไม่อัปเดต)
  for (const mock of users) {
    const passwordHash = await bcrypt.hash(mock.password, 10);
    await prisma.user.upsert({
      where: { email: mock.email },
      update: { avatarUrl: mock.avatar },
      create: { email: mock.email, passwordHash, role: mock.role, avatarUrl: mock.avatar },
    });
  }

  console.log(
    `Seeded ${committees.length} committees, ${news.length} news items, ${staffMockups.length} staff mockups, ${participantMockups.length} participant mockups, ${users.length} base users, ${departmentNames.length} departments, ${positionNames.length} positions, ${courseFormatNames.length} course formats, and ${groupNames.length} groups.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
