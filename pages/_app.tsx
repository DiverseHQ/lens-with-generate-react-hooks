import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";


import { RainbowKit } from '../context/RainbowKit'
import LensUserContextProvider from '../context/LensUserContext'

// react query setup
const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {

  return (
    <RainbowKit>
      <QueryClientProvider client={queryClient}>
        <LensUserContextProvider>
  <Component {...pageProps} />
  </LensUserContextProvider>
  </QueryClientProvider>
  </RainbowKit>
  )
}
