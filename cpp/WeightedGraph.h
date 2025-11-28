#ifndef WEIGHTEDGRAPH_H_
#define WEIGHTEDGRAPH_H_
#include "Graph.h"
#include <iostream>
#include <vector>
#include <unordered_map>
#include <map>
#include <unordered_set>
#include <set>
#include <queue>
#include <algorithm>
#include <string>
#include <fstream>
#include <sstream>
#include <ctime>
#include <cstdlib>
#include <cmath>
#include <random>
// #define NDEBUG
#include <cassert>
using namespace std;

class AliasMethod {
public:
    AliasMethod(vector<double>& weights) : size(weights.size()) {
        if (size == 0) {
            throw invalid_argument("vector must have at least one element");
        }
        alias.resize(size);
        probability.resize(size);
        vector<double> norm_weights(weights);
        double sum = accumulate(norm_weights.begin(), norm_weights.end(), 0.0);
        for (auto& w : norm_weights) {
            w *= size / sum; // 正規化
        }

        vector<int> small, large;
        for (int i = 0; i < size; ++i) {
            if (norm_weights[i] < 1.0) {
                small.push_back(i);
            } else {
                large.push_back(i);
            }
        }

        while (!small.empty() && !large.empty()) {
            int s = small.back();
            small.pop_back();
            int l = large.back();
            large.pop_back();

            probability[s] = norm_weights[s];
            alias[s] = l;

            norm_weights[l] = (norm_weights[l] + norm_weights[s]) - 1.0;

            if (norm_weights[l] < 1.0) {
                small.push_back(l);
            } else {
                large.push_back(l);
            }
        }

        while (!large.empty()) {
            int l = large.back();
            large.pop_back();
            probability[l] = 1.0;
        }

        while (!small.empty()) {
            int s = small.back();
            small.pop_back();
            probability[s] = 1.0;
        }
    }
    AliasMethod() {
    }

public:
    int sample() const {
        int i = (int)(rand() % size);
        return (double)rand()/RAND_MAX < probability[i] ? i : alias[i];
    }

private:
    vector<int> alias;
    vector<double> probability;
    int size;
};

class WeightedGraph : public Graph {
public:
    WeightedGraph(string data_dir, bool with_no_edge=false);

public:
    double get_weighted_degree(int node_id) const {
        return accumulate(src_to_rate_vec.at(node_id).begin(), src_to_rate_vec.at(node_id).end(), 0.0);
    }
    int get_random_adjacent(int node_id) const override; // node_id が dangling の場合，-1を返す
    
    pair<map<int, double>, map<int, double>> calc_ppr_by_fp(const map<int, double>& src_map, int walk_count, double alpha) const override;
    pair<map<int, double>, map<int, double>> calc_ppr_by_fp_full_path(const map<int, double>& src_map, int walk_count, double alpha, double& total_step) const override;
    
    vector<double> calc_pagerank_by_power_iteration(double alpha, double epsilon) const override;
    vector<double> calc_eigenvector_centrality_by_power_iteration(double epsilon) const override; 
    vector<double> calc_degree_centrality() const override; 
    vector<double> get_distances_by_dijkstra(int source_id) const override;
    void show_edge_list() const override;

    double get_normalized_edge_weight(int src_id, int dst_id) const {
        return src_to_dst_to_normalized_weight.at(src_id).at(dst_id);
    }
    
    // undirected graph では両方向挿入. 返り値は挿入したエッジ数
    int insert_edge(int src_id, int dst_id, double weight); 
    int insert_edge(int src_id, int dst_id) = delete;
    // undirected graph では両方向削除. 返り値は削除したエッジ数
    int remove_edge(int src_id, int dst_id) override;
    vector<pair<int, int>> load_edge_list() const = delete;
    vector<tuple<int, int, double>> load_weighted_edge_list() const;
    int _insert_edge_without_updating_alias(int src_id, int dst_id, double weight);
    int _remove_edge_without_updating_alias(int src_id, int dst_id);
    void _normalize_weight(int node_id);
    void _update_alias(int node_id) {
        if (get_adj_num(node_id) == 0) return;
        node_to_alias[node_id] = AliasMethod(src_to_rate_vec[node_id]);
    }
    vector<vector<double>> src_to_rate_vec;

private:
    vector<unordered_map<int, double>> src_to_dst_to_normalized_weight; // src_node -> dst_node -> weight. * あるノードを起点とするエッジの重みの総和は1
    vector<AliasMethod> node_to_alias;
    
};

#endif