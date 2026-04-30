.PHONY: help install pull pull-southbound pull-sectors pull-stocks dev build clean

help:
	@echo "make install            # 安装 Python 依赖"
	@echo "make pull               # 拉取全部：南向 + 板块指数 + 热门个股"
	@echo "make pull-southbound    # 仅南向资金历史"
	@echo "make pull-sectors       # 仅板块指数日线"
	@echo "make pull-stocks        # 仅港股热门排行"
	@echo "make dev                # 启动 Next.js dev (http://localhost:3000)"
	@echo "make build              # 生产构建"

install:
	pip3 install -r ingest/requirements.txt

pull: pull-southbound pull-sectors pull-stocks

pull-southbound:
	cd ingest && python3 pull_southbound.py

pull-sectors:
	cd ingest && python3 pull_sectors.py

pull-stocks:
	cd ingest && python3 pull_hot_stocks.py

dev:
	cd web && npm run dev

build:
	cd web && npm run build

clean:
	rm -f db/data.db db/data.db-wal db/data.db-shm
