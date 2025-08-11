type Language = { name: string };
type Stargazers = { totalCount: number };
type Repository = {
  languages: { nodes: Language[] };
  stargazers: Stargazers;
};
export type GitHubUserRepository = {
  repositories: {
    totalCount: number;
    nodes: Repository[];
  };
};

export type GitHubUserIssue = {
  openIssues: {
    totalCount: number;
  };
  closedIssues: {
    totalCount: number;
  };
};

export type GitHubUserPullRequest = {
  pullRequests: {
    totalCount: number;
  };
};

export type GitHubUserActivity = {
  createdAt: string;
  contributionsCollection: {
    totalCommitContributions: number;
    restrictedContributionsCount: number;
    totalPullRequestReviewContributions: number;
  };
  organizations: {
    totalCount: number;
  };
  followers: {
    totalCount: number;
  };
};
export class UserInfo {
  public readonly totalCommits: number;
  public readonly totalFollowers: number;
  public readonly totalIssues: number;
  public readonly totalOrganizations: number;
  public readonly totalPullRequests: number;
  public readonly totalReviews: number;
  public readonly totalStargazers: number;
  public readonly totalRepositories: number;
  public readonly languageCount: number;
  public readonly durationYear: number;
  public readonly durationDays: number;
  public readonly ancientAccount: number;
  public readonly joined2020: number;
  public readonly ogAccount: number;
  constructor(
    userActivity: GitHubUserActivity | null,
    userIssue: GitHubUserIssue | null,
    userPullRequest: GitHubUserPullRequest | null,
    userRepository: GitHubUserRepository,
  ) {
    // Handle null userActivity due to rate limits
    const totalCommits = userActivity ? 
      userActivity.contributionsCollection.restrictedContributionsCount +
      userActivity.contributionsCollection.totalCommitContributions : 0;
      
    const totalStargazers = userRepository.repositories.nodes.reduce(
      (prev: number, node: Repository) => {
        return prev + node.stargazers.totalCount;
      },
      0,
    );

    const languages = new Set<string>();
    userRepository.repositories.nodes.forEach((node: Repository) => {
      if (node.languages.nodes != undefined) {
        node.languages.nodes.forEach((node: Language) => {
          if (node != undefined) {
            languages.add(node.name);
          }
        });
      }
    });
    
    // Handle null userActivity for date calculations
    const createdAt = userActivity?.createdAt || new Date().toISOString();
    const durationTime = new Date().getTime() - new Date(createdAt).getTime();
    const durationYear = new Date(durationTime).getUTCFullYear() - 1970;
    const durationDays = Math.floor(
      durationTime / (1000 * 60 * 60 * 24) / 100,
    );
    const ancientAccount = new Date(createdAt).getFullYear() <= 2010 ? 1 : 0;
    const joined2020 = new Date(createdAt).getFullYear() == 2020 ? 1 : 0;
    const ogAccount = new Date(createdAt).getFullYear() <= 2008 ? 1 : 0;

    this.totalCommits = totalCommits;
    this.totalFollowers = userActivity?.followers.totalCount || 0;
    this.totalIssues = userIssue ? 
      userIssue.openIssues.totalCount + userIssue.closedIssues.totalCount : 0;
    this.totalOrganizations = userActivity?.organizations.totalCount || 0;
    this.totalPullRequests = userPullRequest?.pullRequests.totalCount || 0;
    this.totalReviews = userActivity?.contributionsCollection.totalPullRequestReviewContributions || 0;
    this.totalStargazers = totalStargazers;
    this.totalRepositories = userRepository.repositories.totalCount;
    this.languageCount = languages.size;
    this.durationYear = durationYear;
    this.durationDays = durationDays;
    this.ancientAccount = ancientAccount;
    this.joined2020 = joined2020;
    this.ogAccount = ogAccount;
  }
}
