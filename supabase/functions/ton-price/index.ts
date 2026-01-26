const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedTonData = {
  price: null as number | null,
  expiresAt: 0
};

async function getTonPriceOnDemand(): Promise<number> {
  const now = Date.now();

  // Если кеш актуален — возвращаем
  if (cachedTonData.price && now < cachedTonData.expiresAt) {
    console.log("Курс TON из кеша:", cachedTonData.price);
    return cachedTonData.price;
  }

  // Иначе запрос к CoinGecko
  try {
    console.log("Запрос курса TON к CoinGecko...");
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd'
    );
    const data = await response.json();
    const price = data['the-open-network'].usd;

    // Обновляем кеш на 5 минут
    cachedTonData = {
      price: price,
      expiresAt: now + (5 * 60 * 1000)
    };

    console.log("Курс TON обновлен:", price);
    return price;
  } catch (error) {
    console.error("Ошибка API CoinGecko:", error);
    return cachedTonData.price || 2.5; // Fallback
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const price = await getTonPriceOnDemand();
  
  return new Response(
    JSON.stringify({ price }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
