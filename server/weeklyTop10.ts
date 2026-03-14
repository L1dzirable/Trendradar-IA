import Parser from "rss-parser";

const parser = new Parser();

export async function getWeeklyTop10() {

  const hn = await parser.parseURL("https://hnrss.org/frontpage");
  const productHunt = await parser.parseURL("https://www.producthunt.com/feed");

  const topics: string[] = [];

  hn.items.slice(0, 10).forEach((item) => {
    if (item.title) {
      topics.push(item.title);
    }
  });

  productHunt.items.slice(0, 10).forEach((item) => {
    if (item.title) {
      topics.push(item.title);
    }
  });

  const top10 = topics.slice(0, 10);

  return {
    items_count: top10.length,
    sources_ok: {
      hackernews: true,
      producthunt: true
    },
    top10
  };
}