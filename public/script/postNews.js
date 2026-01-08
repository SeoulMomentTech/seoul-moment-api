const main = async () => {
  const test = await fetch('https://api.seoulmoment.com.tw/health');
  const data = await test.json();
  console.log(data);
};

void main();
