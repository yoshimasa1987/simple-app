function fizzbuzz(n) {
  const result = [];
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) {
      result.push('FizzBuzz');
    } else if (i % 3 === 0) {
      result.push('Fizz');
    } else if (i % 5 === 0) {
      result.push('Buzz');
    } else {
      result.push(String(i));
    }
  }
  return result;
}

// 直接実行された場合は 1〜100 を出力する
if (require.main === module) {
  const max = process.argv[2] ? Number(process.argv[2]) : 100;
  console.log(fizzbuzz(max).join('\n'));
}

module.exports = fizzbuzz;
