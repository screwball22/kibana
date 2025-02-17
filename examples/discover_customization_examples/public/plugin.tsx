/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import {
  EuiButton,
  EuiContextMenu,
  EuiFlexItem,
  EuiPopover,
  EuiWrappingPopover,
} from '@elastic/eui';
import {
  AppNavLinkStatus,
  CoreSetup,
  CoreStart,
  Plugin,
  SimpleSavedObject,
} from '@kbn/core/public';
import type { DeveloperExamplesSetup } from '@kbn/developer-examples-plugin/public';
import type { DiscoverSetup, DiscoverStart } from '@kbn/discover-plugin/public';
import { noop } from 'lodash';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import useObservable from 'react-use/lib/useObservable';
import image from './discover_customization_examples.png';

export interface DiscoverCustomizationExamplesSetupPlugins {
  developerExamples: DeveloperExamplesSetup;
  discover: DiscoverSetup;
}

export interface DiscoverCustomizationExamplesStartPlugins {
  discover: DiscoverStart;
}

const PLUGIN_ID = 'discoverCustomizationExamples';
const PLUGIN_NAME = 'Discover Customizations';

export class DiscoverCustomizationExamplesPlugin implements Plugin {
  setup(core: CoreSetup, plugins: DiscoverCustomizationExamplesSetupPlugins) {
    core.application.register({
      id: PLUGIN_ID,
      title: PLUGIN_NAME,
      navLinkStatus: AppNavLinkStatus.hidden,
      mount() {
        plugins.discover?.locator?.navigate(
          { profile: 'customization-examples' },
          { replace: true }
        );
        return noop;
      },
    });

    plugins.developerExamples.register({
      appId: PLUGIN_ID,
      title: PLUGIN_NAME,
      description: 'Example plugin that uses the Discover customization framework.',
      image,
    });
  }

  start(core: CoreStart, plugins: DiscoverCustomizationExamplesStartPlugins) {
    const { discover } = plugins;

    let isOptionsOpen = false;
    const optionsContainer = document.createElement('div');
    const closeOptionsPopover = () => {
      ReactDOM.unmountComponentAtNode(optionsContainer);
      document.body.removeChild(optionsContainer);
      isOptionsOpen = false;
    };

    discover.registerCustomizationProfile('customization-examples', {
      customize: async ({ customizations, stateContainer }) => {
        customizations.set({
          id: 'top_nav',
          defaultMenu: {
            newItem: { disabled: true },
            openItem: { disabled: true },
            shareItem: { order: 200 },
            alertsItem: { disabled: true },
            inspectItem: { disabled: true },
            saveItem: { order: 400 },
          },
          getMenuItems: () => [
            {
              data: {
                id: 'options',
                label: 'Options',
                iconType: 'arrowDown',
                iconSide: 'right',
                testId: 'customOptionsButton',
                run: (anchorElement: HTMLElement) => {
                  if (isOptionsOpen) {
                    closeOptionsPopover();
                    return;
                  }

                  isOptionsOpen = true;
                  document.body.appendChild(optionsContainer);

                  const element = (
                    <EuiWrappingPopover
                      ownFocus
                      button={anchorElement}
                      isOpen={true}
                      panelPaddingSize="s"
                      closePopover={closeOptionsPopover}
                    >
                      <EuiContextMenu
                        size="s"
                        initialPanelId={0}
                        panels={[
                          {
                            id: 0,
                            items: [
                              {
                                name: 'Create new',
                                icon: 'plusInCircle',
                                onClick: () => alert('Create new clicked'),
                              },
                              {
                                name: 'Make a copy',
                                icon: 'copy',
                                onClick: () => alert('Make a copy clicked'),
                              },
                              {
                                name: 'Manage saved searches',
                                icon: 'gear',
                                onClick: () => alert('Manage saved searches clicked'),
                              },
                            ],
                          },
                        ]}
                        data-test-subj="customOptionsPopover"
                      />
                    </EuiWrappingPopover>
                  );

                  ReactDOM.render(element, optionsContainer);
                },
              },
              order: 100,
            },
            {
              data: {
                id: 'documentExplorer',
                label: 'Document explorer',
                iconType: 'discoverApp',
                testId: 'documentExplorerButton',
                run: () => {
                  discover.locator?.navigate({});
                },
              },
              order: 300,
            },
          ],
        });

        customizations.set({
          id: 'search_bar',
          CustomDataViewPicker: () => {
            const [isPopoverOpen, setIsPopoverOpen] = useState(false);
            const togglePopover = () => setIsPopoverOpen((open) => !open);
            const closePopover = () => setIsPopoverOpen(false);
            const [savedSearches, setSavedSearches] = useState<
              Array<SimpleSavedObject<{ title: string }>>
            >([]);

            useEffect(() => {
              core.savedObjects.client
                .find<{ title: string }>({ type: 'search' })
                .then((response) => {
                  setSavedSearches(response.savedObjects);
                });
            }, []);

            const currentSavedSearch = useObservable(
              stateContainer.savedSearchState.getCurrent$(),
              stateContainer.savedSearchState.getState()
            );

            return (
              <EuiFlexItem grow={false}>
                <EuiPopover
                  button={
                    <EuiButton
                      iconType="arrowDown"
                      iconSide="right"
                      fullWidth
                      onClick={togglePopover}
                      data-test-subj="logsViewSelectorButton"
                    >
                      {currentSavedSearch.title ?? 'None selected'}
                    </EuiButton>
                  }
                  anchorClassName="eui-fullWidth"
                  isOpen={isPopoverOpen}
                  panelPaddingSize="none"
                  closePopover={closePopover}
                >
                  <EuiContextMenu
                    size="s"
                    initialPanelId={0}
                    panels={[
                      {
                        id: 0,
                        title: 'Saved logs views',
                        items: savedSearches.map((savedSearch) => ({
                          name: savedSearch.get('title'),
                          onClick: () => stateContainer.actions.onOpenSavedSearch(savedSearch.id),
                          icon: savedSearch.id === currentSavedSearch.id ? 'check' : 'empty',
                          'data-test-subj': `logsViewSelectorOption-${savedSearch.attributes.title.replace(
                            /[^a-zA-Z0-9]/g,
                            ''
                          )}`,
                        })),
                      },
                    ]}
                  />
                </EuiPopover>
              </EuiFlexItem>
            );
          },
        });

        return () => {
          // eslint-disable-next-line no-console
          console.log('Cleaning up Logs explorer customizations');
        };
      },
    });
  }
}
