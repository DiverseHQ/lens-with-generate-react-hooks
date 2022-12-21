import React, { useEffect, useState } from "react";
import { useHasTxHashBeenIndexedQuery } from "../../graphql/generated";

let loop = true;

export function usePollUntilIndexed(queryClient) {
  const [requestType, setRequestType] = useState(null);
  const [request, setRequest] = useState(null);
  const [polling, setPolling] = useState(false);
  const [txResponse, setTxResponse] = useState(null);

  const handleSetRequest = (type, req) => {
    setRequestType(type);
    setRequest(req);
  };

  const lensHasTxBeenIndexedQuery = useHasTxHashBeenIndexedQuery(
    {
      request,
    },
    {
      enabled: !!request,
    }
  );
  const { data } = lensHasTxBeenIndexedQuery;

  async function pollUntilIndexed() {
    setPolling(true);
    // eslint-disable-next-line
    while (loop) {
      console.log("in loop");
      queryClient.invalidateQueries({
        queryKey: ["hasTxHashBeenIndexed"],
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    setPolling(false);
  }

  useEffect(() => {
    // rerun query when request changes
    if (request) {
      queryClient.invalidateQueries({
        queryKey: ["hasTxHashBeenIndexed"],
      });
      setTxResponse(null);
    }
  }, [request]);

  useEffect(() => {
    if (!polling && !txResponse && request) {
      console.log("polling started");
      loop = true;
      pollUntilIndexed();
    }
  }, [request, txResponse]);

  useEffect(() => {
    console.log("data", data);
    if (data?.hasTxHashBeenIndexed?.indexed) {
      if (loop) {
        loop = false;
      }
      setTxResponse(data.hasTxHashBeenIndexed);
    }
  }, [data]);

  return { txResponse, handleSetRequest, requestType, polling };
}
