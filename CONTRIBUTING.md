Hey there! We are really excited that you are interested in contributing. Before submitting your contribution, please make sure to take a moment and read through the following guide:
## Sending Pull Request

### Discuss First

Before you start to work on a feature pull request, it's always better to open a feature request issue first to [discuss](https://github.com/massCodeIO/massCode/discussions) with the maintainers whether the feature is desired and the design of those features. This would help save time for both the maintainers and the contributors and help features to be shipped faster.

For typo fixes, it's recommended to batch multiple typo fixes into one pull request to maintain a cleaner commit history.

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages, which allows the changelog to be auto-generated based on the commits. Please read the guide through if you aren't familiar with it already.

Only `fix:` and `feat:` will be presented in the changelog.

Note that `fix:` and `feat:` are for actual code changes (that might affect logic). For typo or document changes, use docs: or chore: instead:

- ~~`fix: typo`~~ -> `docs: fix typo`

### Pull Request

If you don't know how to send a Pull Request, we recommend reading the [guide](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).

When sending a pull request, make sure your PR's title also follows the Commit Convention.

If your PR fixes or resolves an existing issue, please add the following line in your PR description (replace 123 with a real issue number):

```
fix #123
```

It's ok to have multiple commits in a single PR, you don't need to rebase or force push for your changes as we will use Squash and Merge to squash the commits into one commit when merging.

And of course please test your code before PR. 