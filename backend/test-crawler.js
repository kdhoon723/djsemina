import { initializeCrawler, crawl, closeCrawler } from './crawler.js';
import { initializeAPICrawler, crawlAPI, closeAPICrawler } from './api-crawler.js';

/**
 * 크롤러 비교 테스트
 */
async function compareCrawlers() {
  const dateToTest = new Date().toISOString().slice(0, 10); // 오늘 날짜
  const fridayDate = '2025-10-31'; // 금요일 날짜

  console.log('='.repeat(80));
  console.log('크롤러 비교 테스트 시작');
  console.log('='.repeat(80));

  // 1. API 방식 테스트
  console.log('\n📊 [1/2] API 방식 테스트');
  console.log('-'.repeat(80));

  let apiResults = [];
  let apiTime = 0;

  try {
    await initializeAPICrawler();

    const apiStartTime = Date.now();
    apiResults = await crawlAPI(dateToTest);
    apiTime = (Date.now() - apiStartTime) / 1000;

    await closeAPICrawler();

    console.log(`\n[API 결과] ${apiResults.length}개 방 조회 완료 (${apiTime.toFixed(2)}초)`);
    apiResults.forEach(room => {
      console.log(`  - ${room.title}: ${room.times.length}개 시간대`);
    });
  } catch (error) {
    console.error('[API 테스트 실패]', error);
  }

  console.log('\n' + '='.repeat(80));

  // 2. Puppeteer 방식 테스트
  console.log('\n📊 [2/2] Puppeteer 방식 테스트');
  console.log('-'.repeat(80));

  let puppeteerResults = [];
  let puppeteerTime = 0;

  try {
    await initializeCrawler();

    const puppeteerStartTime = Date.now();
    puppeteerResults = await crawl(dateToTest);
    puppeteerTime = (Date.now() - puppeteerStartTime) / 1000;

    await closeCrawler();

    console.log(`\n[Puppeteer 결과] ${puppeteerResults.length}개 방 조회 완료 (${puppeteerTime.toFixed(2)}초)`);
    puppeteerResults.forEach(room => {
      console.log(`  - ${room.title}: ${room.times.length}개 시간대`);
    });
  } catch (error) {
    console.error('[Puppeteer 테스트 실패]', error);
  }

  // 3. 결과 비교
  console.log('\n' + '='.repeat(80));
  console.log('📊 비교 결과');
  console.log('='.repeat(80));

  console.log(`\n방 개수:`);
  console.log(`  - API: ${apiResults.length}개`);
  console.log(`  - Puppeteer: ${puppeteerResults.length}개`);

  console.log(`\n실행 시간:`);
  console.log(`  - API: ${apiTime.toFixed(2)}초`);
  console.log(`  - Puppeteer: ${puppeteerTime.toFixed(2)}초`);
  console.log(`  - 속도 개선: ${((puppeteerTime - apiTime) / puppeteerTime * 100).toFixed(1)}% 빠름`);

  // 데이터 일치 확인
  console.log(`\n데이터 일치성 확인:`);
  const apiRoomNames = new Set(apiResults.map(r => r.title));
  const puppeteerRoomNames = new Set(puppeteerResults.map(r => r.title));

  const onlyInAPI = [...apiRoomNames].filter(name => !puppeteerRoomNames.has(name));
  const onlyInPuppeteer = [...puppeteerRoomNames].filter(name => !apiRoomNames.has(name));

  if (onlyInAPI.length === 0 && onlyInPuppeteer.length === 0) {
    console.log(`  ✅ 모든 방이 일치합니다!`);
  } else {
    console.log(`  ⚠️ 차이가 있습니다:`);
    if (onlyInAPI.length > 0) {
      console.log(`    API에만 있는 방: ${onlyInAPI.join(', ')}`);
    }
    if (onlyInPuppeteer.length > 0) {
      console.log(`    Puppeteer에만 있는 방: ${onlyInPuppeteer.join(', ')}`);
    }
  }

  // 4. 오늘 날짜가 마감이면 금요일로 추가 테스트
  const todayHasAvailability = apiResults.some(r => r.times && r.times.length > 0) ||
                                puppeteerResults.some(r => r.times && r.times.length > 0);

  if (!todayHasAvailability) {
    console.log('\n' + '='.repeat(80));
    console.log(`⚠️ 오늘(${dateToTest})은 예약이 마감되었습니다. 금요일(${fridayDate})로 추가 테스트합니다.`);
    console.log('='.repeat(80));

    console.log('\n📊 금요일 API 방식 테스트');
    console.log('-'.repeat(80));

    try {
      await initializeAPICrawler();

      const fridayAPIStartTime = Date.now();
      const fridayAPIResults = await crawlAPI(fridayDate);
      const fridayAPITime = (Date.now() - fridayAPIStartTime) / 1000;

      await closeAPICrawler();

      console.log(`\n[금요일 API 결과] ${fridayAPIResults.length}개 방 조회 완료 (${fridayAPITime.toFixed(2)}초)`);

      const availableRooms = fridayAPIResults.filter(r => r.times && r.times.length > 0);
      console.log(`\n예약 가능한 방: ${availableRooms.length}개`);
      availableRooms.slice(0, 5).forEach(room => {
        console.log(`  - ${room.title}: ${room.times.length}개 시간대`);
        if (room.times.length > 0) {
          console.log(`    예: ${room.times[0].start} ~ ${room.times[0].end}`);
        }
      });
    } catch (error) {
      console.error('[금요일 API 테스트 실패]', error);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('테스트 완료!');
  console.log('='.repeat(80));
}

// 실행
compareCrawlers().catch(console.error);
