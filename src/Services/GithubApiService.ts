import { GithubRepository } from "../Repository/GithubRepository.ts";
import {
  GitHubUserActivity,
  GitHubUserIssue,
  GitHubUserPullRequest,
  GitHubUserRepository,
  UserInfo,
} from "../user_info.ts";
import {
  queryUserActivity,
  queryUserIssue,
  queryUserPullRequest,
  queryUserRepository,
} from "../Schemas/index.ts";
import { Retry } from "../Helpers/Retry.ts";
import { CONSTANTS } from "../utils.ts";
import { EServiceKindError, ServiceError } from "../Types/index.ts";
import { Logger } from "../Helpers/Logger.ts";
import { requestGithubData } from "./request.ts";

// Need to be here - Exporting from another file makes array of null
export const TOKENS = [
  Deno.env.get("GITHUB_TOKEN1"),
  Deno.env.get("GITHUB_TOKEN2"),
];

export class GithubApiService extends GithubRepository {
  async requestUserRepository(
    username: string,
  ): Promise<GitHubUserRepository | ServiceError> {
    return await this.executeQuery<GitHubUserRepository>(queryUserRepository, {
      username,
    });
  }
  async requestUserActivity(
    username: string,
  ): Promise<GitHubUserActivity | ServiceError> {
    return await this.executeQuery<GitHubUserActivity>(queryUserActivity, {
      username,
    });
  }
  async requestUserIssue(
    username: string,
  ): Promise<GitHubUserIssue | ServiceError> {
    return await this.executeQuery<GitHubUserIssue>(queryUserIssue, {
      username,
    });
  }
  async requestUserPullRequest(
    username: string,
  ): Promise<GitHubUserPullRequest | ServiceError> {
    return await this.executeQuery<GitHubUserPullRequest>(
      queryUserPullRequest,
      { username },
    );
  }
  async requestUserInfo(username: string): Promise<UserInfo | ServiceError> {
    // Avoid to call others if one of them is null
    const repository = await this.requestUserRepository(username);

    if (repository instanceof ServiceError) {
      Logger.error(repository);
      return repository;
    }

    // If repository is null due to rate limit, try to continue with partial data
    if (repository === null) {
      Logger.warn(`Rate limit hit when fetching repository data for ${username}. Attempting to continue with partial data.`);
      // Return a ServiceError to indicate limited functionality, but with a more user-friendly message
      return new ServiceError("Data temporarily limited due to API constraints. Please try again later for complete information.", EServiceKindError.RATE_LIMIT);
    }

    const promises = Promise.allSettled([
      this.requestUserActivity(username),
      this.requestUserIssue(username),
      this.requestUserPullRequest(username),
    ]);
    const [activity, issue, pullRequest] = await promises;
    const status = [
      activity.status,
      issue.status,
      pullRequest.status,
    ];

    if (status.includes("rejected")) {
      Logger.error(`Can not find a user with username:' ${username}'`);
      return new ServiceError("Not found", EServiceKindError.NOT_FOUND);
    }

    // Handle null values due to rate limits gracefully
    const activityValue = activity.status === "fulfilled" ? activity.value : null;
    const issueValue = issue.status === "fulfilled" ? issue.value : null; 
    const pullRequestValue = pullRequest.status === "fulfilled" ? pullRequest.value : null;

    // If any data is null due to rate limits, log a warning but continue
    if (activityValue === null || issueValue === null || pullRequestValue === null) {
      Logger.warn(`Some data unavailable due to rate limits for user ${username}. Continuing with available data.`);
    }

    return new UserInfo(
      activityValue as GitHubUserActivity,
      issueValue as GitHubUserIssue,
      pullRequestValue as GitHubUserPullRequest,
      repository,
    );
  }

  async executeQuery<T = unknown>(
    query: string,
    variables: { [key: string]: string },
  ) {
    try {
      const retry = new Retry(
        TOKENS.length,
        CONSTANTS.DEFAULT_GITHUB_RETRY_DELAY,
      );
      return await retry.fetch<Promise<T>>(async ({ attempt }) => {
        const result = await requestGithubData(
          query,
          variables,
          TOKENS[attempt],
        );
        
        // If rate limit was hit and null was returned, skip retry and return null
        if (result === null) {
          Logger.warn(`Rate limit hit for token ${attempt + 1}. Skipping retry and returning null.`);
          return null;
        }
        
        return result;
      });
    } catch (error) {
      if (error.cause instanceof ServiceError) {
        Logger.error(error.cause.message);
        return error.cause;
      }
      if (error instanceof Error && error.cause) {
        Logger.error(JSON.stringify(error.cause, null, 2));
      } else {
        Logger.error(error);
      }
      return new ServiceError("not found", EServiceKindError.NOT_FOUND);
    }
  }
}
