const { GraphQLClient } = require('graphql-request')

function getGithubClient (token) {
  return new GraphQLClient(
    'https://api.github.com/graphql', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
}

async function getGithubData ({owner, logger}) {
  logger.debug('Entering getGithubData for owner: ', owner)

  try {
    return queryGithub({
      query: getQueryTemplate(),
      owner,
      client: getGithubClient(process.env.GITHUB_TOKEN)
    })
  } catch (error) {
    logger.error(error)
  }
}
async function getGithubData ({owner, repoName, logger}) {
  logger.debug('Entering getGithubData for owner: ', owner)

  try {
    return queryGithub({
      query: getQueryTemplate(),
      owner,
      client: getGithubClient(process.env.GITHUB_TOKEN)
    })
  } catch (error) {
    logger.error(error)
  }
}
async function queryGithub ({query, owner, client, cursor = null, githubData = []}) {
  const queryParams = {
    agency: owner,
    queryBatch: parseInt(process.env.GITHUB_QUERY_BATCHES)
  }

  if (cursor) {
    queryParams.repositoryCursor = cursor
  }
  setTimeout(async () => {
    try {
      const data = await client.request(query, queryParams)
      githubData.push.apply(githubData, _handleGraphqlResponse(data))

      if (data && data.repositoryOwner && data.repositoryOwner.repositories.pageInfo.hasNextPage) {
        return queryGithub({
          query,
          owner,
          client,
          cursor: data.repositoryOwner.repositories.pageInfo.endCursor,
          githubData
        })
      } else {
        return githubData
      }
    } catch (error) {
      throw error
    }
  }, 1000)
}

function getQueryTemplate (owner) {
  return `query CodeGovRepoStats($agency: String!, $queryBatch: Int = 100, $repositoryCursor: String) {
    repositoryOwner(login: $agency) {
      repositories(first: $queryBatch, after: $repositoryCursor) {
        edges {
          node {
            owner {
              ... on User {
                name
                url
                email
              }
              ... on Organization {
                name
                url
                email
              }
            }
            nameWithOwner
            createdAt
            forkCount
            isFork
            watchers {
              totalCount
            }
            stargazers {
              totalCount
            }
            pullRequests {
              totalCount
            }
            issues {
              totalCount
            }
            languages(first: 20) {
              nodes {
                name
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    rateLimit {
      limit
      cost
      remaining
      resetAt
    }
  }`
}

function _handleGraphqlResponse (responseObject) {
  const repositories = responseObject.repositoryOwner.repositories.edges

  return repositories.reduce((resultRepos, repo) => {
    resultRepos.push({
      name: repo.node.owner.name,
      email: repo.node.owner.email || '',
      url: repo.node.owner.url,
      repository: {
        name: repo.node.nameWithOwner,
        isFork: repo.node.isFork,
        createdAt: repo.node.createdAt,
        forks: repo.node.forksCount,
        issues: repo.node.issues.totalCount,
        stargazers: repo.node.stargazers.totalCount,
        watchers: repo.node.watchers.totalCount,
        pullRequests: repo.node.pullRequests.totalCount,
        languages: repo.node.languages.nodes.reduce((languages, node) => {
          languages.push(node.name)
          return languages
        }, [])
      }
    })

    return resultRepos
  }, [])
}

function getGithubReposDataByOwner ({repoOwnerList, logger}) {
  return Promise.all(
    repoOwnerList.map(repoOwner => {
      return getGithubData({
        owner: repoOwner,
        logger
      })
    })
  )
}

function getGithubInformation (repoUrls, logger) {
  logger.info('Get Github data start.')
  Promise.all(
    repoUrls.map(repoUrl => {
      return getGithubData({repoUrl, logger})
        .then(githubData => {
          return githubData
        })
        .catch(error => {
          logger.error(`[ERROR] message: ${error.message}`)
          logger.error(`[ERROR] stack: ${error.stack}`)
        })
    })
  )
    .catch(error => {
      logger.error(`[ERROR] ${error}`)
    })
}

function parseGithubUrl (githubUrl) {
  if (githubUrl.match(/\/$/)) {
    githubUrl = githubUrl.replace(/\/$/, '')
  }
  if (githubUrl.match(/\.git$/)) {
    githubUrl = githubUrl.replace(/\.git$/, '')
  }
  if (githubUrl.match(/^https:\/\/github.com\//)) {
    githubUrl = githubUrl.replace(/^https:\/\/github.com\//, '')
  }
  if (githubUrl.match(/^git@github.com:\//)) {
    githubUrl = githubUrl.replace(/^git@github.com:\//, '')
  }
  const githubOwnerAndRepo = githubUrl.split('/')
  return {
    owner: githubOwnerAndRepo[0],
    repo: githubOwnerAndRepo[1]
  }
}

function isGithubUrl (repoUrl) {
  const githubUrlRegEx = /github.com/
  if (repoUrl) {
    const match = repoUrl.match(githubUrlRegEx)

    if (match) {
      return true
    }
  }

  return false
}

function getUniqueGithubRepoOwners (repoUrls) {
  const uniqueRepoOwners = new Set()

  repoUrls.forEach(repoUrl => {
    const { owner } = parseGithubUrl(repoUrl)
    uniqueRepoOwners.add(owner)
  })

  return Array.from(uniqueRepoOwners)
}

module.exports = {
  parseGithubUrl,
  isGithubUrl,
  getGithubInformation,
  getGithubReposDataByOwner,
  getUniqueGithubRepoOwners
}
