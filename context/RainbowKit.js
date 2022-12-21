import React from "react";

import '@rainbow-me/rainbowkit/styles.css';

import { getDefaultWallets, RainbowKitProvider, darkTheme, midnightTheme } from "@rainbow-me/rainbowkit";
import { configureChains, createClient, WagmiConfig } from "wagmi";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { publicProvider } from "wagmi/providers/public";

import { polygonMumbai } from 'wagmi/chains';

const { chains, provider } = configureChains(
  [polygonMumbai],
  [publicProvider()]
);

const { connectors } = getDefaultWallets({
  appName: "DiverseHQ",
  chains
});

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider
});

export const RainbowKit = ({ children }) => {
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider chains={chains} theme={midnightTheme()}>
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  );
};
