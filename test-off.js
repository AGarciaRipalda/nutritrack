const https = require('https');
const options = {
  hostname: 'world.openfoodfacts.org',
  path: '/api/v2/search?categories_tags_en=banana&fields=product_name,nutriments,image_front_small_url&page_size=1',
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://metabolic.es',
    'Access-Control-Request-Method': 'GET'
  }
};
const req = https.request(options, (res) => {
  console.log("Status:", res.statusCode);
  console.log("Headers:", res.headers);
});
req.end();
