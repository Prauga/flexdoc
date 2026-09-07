import {
  createCachedFlexDocPage,
  flexDocPageEtag,
  matchesFlexDocEtag,
} from './page-cache';

describe('FlexDoc page cache', () => {
  it('renders once and reuses the exact cached page', async () => {
    const render = jest.fn(() => '<html>cached</html>');
    const getPage = createCachedFlexDocPage(render);

    const first = await getPage();
    const second = await getPage();

    expect(render).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(first.etag).toBe(flexDocPageEtag(first.body));
  });

  it('drops a failed render so a later request can retry', async () => {
    const render = jest.fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce('<html>recovered</html>');
    const getPage = createCachedFlexDocPage(render);

    await expect(getPage()).rejects.toThrow('temporary failure');
    await expect(getPage()).resolves.toEqual(expect.objectContaining({ body: '<html>recovered</html>' }));
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent cold requests and produces stable ETags across host instances', async () => {
    const render = jest.fn(async () => '<html>shared</html>');
    const firstHost = createCachedFlexDocPage(render);

    const pages = await Promise.all(Array.from({ length: 100 }, () => firstHost()));
    expect(render).toHaveBeenCalledTimes(1);
    expect(pages.every((page) => page === pages[0])).toBe(true);

    const secondHost = createCachedFlexDocPage(() => '<html>shared</html>');
    const secondPage = await secondHost();
    expect(secondPage.etag).toBe(pages[0].etag);
    expect(secondPage.body).toBe(pages[0].body);
  });

  it('accepts strong, weak, wildcard, and comma-separated If-None-Match values', () => {
    const etag = flexDocPageEtag('docs');
    expect(matchesFlexDocEtag(etag, etag)).toBe(true);
    expect(matchesFlexDocEtag(`W/${etag}`, etag)).toBe(true);
    expect(matchesFlexDocEtag('*', etag)).toBe(true);
    expect(matchesFlexDocEtag(`"other", ${etag}`, etag)).toBe(true);
    expect(matchesFlexDocEtag('"other"', etag)).toBe(false);
  });
});
