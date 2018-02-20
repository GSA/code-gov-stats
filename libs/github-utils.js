const { GraphQLClient } = require('graphql-request')
const { delay } = require('./utils')

function getGithubClient (token) {
  return new GraphQLClient(
    'https://api.github.com/graphql', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
}

async function getGithubData ({repoUrl, owner, logger}) {
  logger.debug(`Entering getGithubData for: ${owner || repoUrl}`)
  let graphqlQuery = null
  let repoName = null

  if (repoUrl) {
    ({ owner, repo: repoName } = parseGithubUrl(repoUrl))
    graphqlQuery = getQueryTemplate({singleRepo: true})
  } else {
    graphqlQuery = getQueryTemplate()
  }

  try {
    return queryGithub({
      query: graphqlQuery,
      owner,
      repoName,
      client: getGithubClient(process.env.GITHUB_TOKEN),
      logger
    })
  } catch (error) {
    logger.error(error)
  }
}
async function queryGithub ({query, owner, client, repoName = null, logger, cursor = null, githubData = []}) {
  logger.debug(`Entering queryGithub for owner: ${owner}`)
  let queryParams = {}
  if (repoName && owner) {
    queryParams = { owner, repoName }
  } else {
    queryParams = {
      agency: owner,
      queryBatch: parseInt(process.env.GITHUB_QUERY_BATCHES)
    }
  }

  if (cursor) {
    queryParams.repositoryCursor = cursor
  }

  return client.request(query, queryParams)
    .then(data => {
      logger.debug('Entered delay promise for 2000ms')
      return delay(2000, data)
    })
    .then(data => {
      logger.debug('Entered client.request handler promise.')
      if (data && data.repositoryOwner) {
        githubData.push.apply(githubData, _handleGraphqlResponse(data))
        if (data.repositoryOwner.repositories.pageInfo.hasNextPage) {
          return queryGithub({
            query,
            owner,
            client,
            logger,
            cursor: data.repositoryOwner.repositories.pageInfo.endCursor,
            githubData
          })
        } else {
          return githubData
        }
      }
      if (data && data.repository) {
        return _handleGraphqlResponse(data)
      }
    })
    .catch(error => {
      logger.error(error)
    })
}

function getQueryTemplate ({ singleRepo = false }) {
  if (singleRepo) {
    return `query CodeGoveRepoStats($owner: String!, $repoName: String!){ 
      repository(owner: $owner, name: $repoName) {
        owner {
          ... on User {
            url
            userEmail: email
          }
          ... on Organization {
            url
            organizationEmail: email
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
    }`
  }

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

function _handleMultipleResults (repositories) {
  return repositories.edges.reduce((resultRepos, repo) => {
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
function _handleSingleResult (repository) {
  return {
    owner: {
      name: repository.owner.name,
      email: repository.owner.email || '',
      url: repository.owner.url
    },
    name: repository.nameWithOwner,
    isFork: repository.isFork,
    createdAt: repository.createdAt,
    forks: repository.forkCount,
    issues: repository.issues.totalCount,
    stargazers: repository.stargazers.totalCount,
    watchers: repository.watchers.totalCount,
    pullRequests: repository.pullRequests.totalCount,
    languages: repository.languages.nodes.reduce((languages, node) => {
      languages.push(node.name)
      return languages
    }, [])
  }
}

function _handleGraphqlResponse (responseObject) {
  if (responseObject.repositoryOwner && responseObject.repositoryOwner.repositories) {
    return _handleMultipleResults(responseObject.repositoryOwner.repositories)
  }
  if (responseObject.repository) {
    return _handleSingleResult(responseObject.repository)
  }
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

function getGithubInformation ({repoUrls, logger}) {
  logger.info('Get Github data start.')
  return Promise.all(
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
  if (githubUrl.match(/^(https: || http:)\/\/github.com\//)) {
    githubUrl = githubUrl.replace(/^(https: || http:)\/\/github.com\//, '')
  }
  if (githubUrl.match(/^git:\/\/github.com\//)) {
    githubUrl = githubUrl.replace(/^git:\/\/github.com\//, '')
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
