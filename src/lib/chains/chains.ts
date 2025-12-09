// import {
//     celo,
//     scroll,
//     mainnet
// } from "viem/chains";
// import { createPublicClient, http } from "viem";

// const supportedChains = {
//     ethereum: {
//         ...mainnet,
//         rpcUrls: { default: { http: ['https://rpc.ankr.com/eth'] } }
//     },
//     celo: {
//         ...celo,
//         rpcUrls: { default: { http: ['https://forno.celo.org'] } },
//     },
//     scroll: {
//         ...scroll,
//         rpcUrls: { default: { http: ['https://rpc.scroll.io'] } },
//     }
// }

// const tokens = {
//   usdt: {
//     ethereum: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
//     celo: { address: '0x480A0f4e360E8964e68858Dd231c85b8E5E97aA2', decimals: 6 }, // USDT on Celo
//     scroll: { address: '0xf55BEC22f8f6C69137cEA29aa0421531538D9cA1', decimals: 6 }, // USDT on Scroll
//   },
//   // Add cUSD for Celo: { celo: { address: '0x765DE816845861e75f729276482d658cc9658B52', decimals: 18 } }
// };

// export const safeFactories = {
//   ethereum: '0xYourSafeFactoryAddressOnEth', // From Safe docs
//   celo: '0xSafeFactoryOnCelo', // Check app.safe.global for deployments
//   scroll: '0xSafeFactoryOnScroll',
// };

// const getClient = (chainId:number) => {
//     const chain = Object.values(supportedChains).find(c => c.id === chainId)
//     if (!chain) throw new Error('Unsupported chain');

//     return createPublicClient({
//         chain,
//         transport: http(chain.rpcUrls.default.http[0])
//     })
// }