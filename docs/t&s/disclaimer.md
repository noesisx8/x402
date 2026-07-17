# Research & Market Tools Disclaimer

**x402 Vending Machine**
**Effective Date:** [EFFECTIVE DATE]

---

## 1. Purpose of This Disclaimer

This disclaimer applies to all market-data endpoints and to the **Kronos candle forecast** research tool available through the Service. It supplements the [Terms of Service](/terms) and should be read alongside it.

---

## 2. Research and Informational Use Only

All outputs from the Kronos model and all market-data endpoints (including FX rates, cryptocurrency spot prices, OHLCV data, and directional forecasts) are provided **for research and informational purposes only**.

Nothing returned by these endpoints constitutes:

- **Financial advice** of any kind
- **Investment advice** or a recommendation to invest in any asset
- **A solicitation or offer** to buy, sell, or trade any financial instrument, security, or cryptocurrency
- **Trading signals** intended for direct use in automated or manual trading systems

---

## 3. No Registered Advisor or Broker

[OPERATOR LEGAL NAME] is **not** a registered investment advisor, broker-dealer, financial planner, commodity trading advisor, or financial institution under the laws of any jurisdiction. We are not regulated by the SEC, CFTC, FCA, MAS, or any equivalent regulatory body.

// OPERATOR: Confirm your actual regulatory status with local counsel before publishing. If you are in a jurisdiction where providing this type of data might be regulated, seek specific advice.

---

## 4. Kronos Model - Specific Limitations

The Kronos forecast model is an **open-source research model** (MIT license) that generates OHLCV-based directional candle forecasts and summary outputs. You should be aware that:

- **Model outputs can be wrong.** Forecasts are probabilistic and based on historical patterns. Past patterns do not guarantee future results.
- **Data latency varies.** Upstream market data may be delayed, incomplete, or from sources that experience outages.
- **The model does not account for all market conditions,** including macro events, liquidity crises, regulatory changes, or other factors that can affect asset prices.
- **No backtested or live performance guarantee is made.** Any implied or stated directional probability is a model output only - not a promise of future accuracy.
- **The open-source nature of the model** means its weights, architecture, and training data are subject to the limitations of its development community and MIT license terms.

---

## 5. User Assumes All Risk

**You assume all risk** of relying on or acting on any output from Kronos or any market-data endpoint. This includes, without limitation:

- financial losses from trading or investment decisions informed by these outputs;
- losses arising from delayed or inaccurate data;
- technical failures in your own systems that consume these outputs; and
- decisions made by automated agents or AI clients acting on these outputs under your control.

---

## 6. Suitability for Automated / Agent Consumption

These outputs are designed to be consumed by developers and automated agents. **Automated consumption does not reduce the risk** associated with acting on forecast data. If you are building an automated trading system, investment tool, or advisory product that uses these outputs, you are responsible for:

- ensuring your use complies with applicable financial services regulations in your jurisdiction;
- implementing your own risk controls, circuit breakers, and validation logic;
- disclosing to any end users of your system that underlying data is sourced from a research-only, non-advisory service.

---

## 7. Third-Party Market Data

**Kronos OHLCV history** is fetched via a multi-source cascade intended to work from US cloud hosts: **Bybit (primary), then Kraken, Binance.US, and Binance.com (last resort)**. Spot-price and FX endpoints separately use public providers such as **CoinGecko** (crypto spot) and **Frankfurter/ECB** (with open.er-api fallback) for FX. We make no representations about the accuracy, completeness, or timeliness of data from those sources and are not liable for errors or interruptions in third-party data feeds. The `source_ohlcv` field in Kronos responses identifies which OHLCV source succeeded for that call.

---

## 8. No Guarantee of Availability

Market-data and Kronos endpoints are provided on a best-effort basis. We do not guarantee uptime, response times, or data freshness. Endpoints may be modified, rate-limited, or discontinued at any time.

---

## 9. Consult a Professional

Before making any financial or investment decision, consult a qualified and licensed financial advisor, attorney, or tax professional appropriate for your jurisdiction and circumstances. This Service is not a substitute for professional advice.

---

## 10. Contact

Questions about this disclaimer: [OPERATOR CONTACT EMAIL]
