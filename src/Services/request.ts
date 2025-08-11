import { soxa } from "../../deps.ts";
import {
  EServiceKindError,
  GithubErrorResponse,
  GithubExceedError,
  QueryDefaultResponse,
  ServiceError,
} from "../Types/index.ts";
import { Logger } from "../Helpers/Logger.ts";

export async function requestGithubData<T = unknown>(
  query: string,
  variables: { [key: string]: string },
  token = "",
) {
  const response = await soxa.post("", {}, {
    data: { query, variables },
    headers: {
      Authorization: `bearer ${token}`,
    },
  }) as QueryDefaultResponse<{ user: T }>;
  const responseData = response.data;

  if (responseData?.data?.user) {
    return responseData.data.user;
  }

  const errorResult = handleError(
    responseData as unknown as GithubErrorResponse | GithubExceedError,
  );
  
  // If it's a rate limit error, return null instead of throwing
  if (errorResult === null) {
    return null;
  }
  
  throw errorResult;
}

function handleError(
  reponseErrors: GithubErrorResponse | GithubExceedError,
): ServiceError | null {
  let isRateLimitExceeded = false;
  const arrayErrors = (reponseErrors as GithubErrorResponse)?.errors || [];
  const objectError = (reponseErrors as GithubExceedError) || {};

  if (Array.isArray(arrayErrors)) {
    isRateLimitExceeded = arrayErrors.some((error) =>
      error.type.includes(EServiceKindError.RATE_LIMIT)
    );
  }

  if (objectError?.message) {
    isRateLimitExceeded = objectError?.message.includes(
      "rate limit",
    );
  }

  if (isRateLimitExceeded) {
    Logger.warn("GitHub API rate limit exceeded. Continuing with limited data instead of failing.");
    return null; // Return null instead of throwing error
  }

  return new ServiceError(
    "unknown error",
    EServiceKindError.NOT_FOUND,
  );
}
